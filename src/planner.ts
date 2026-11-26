import { createPrompt } from "./prompt";

const aggregations = ["occurrence", "count", "sum", "mean"] as const;
const directions = ["higher", "lower", "informational"] as const;
const slugPattern = "^[a-z0-9]+(?:[-_][a-z0-9]+)*$";
const slug = new RegExp(slugPattern);

export interface ExperimentPlan {
  flagName: string;
  variants: { key: string; label: string; value: string }[];
  metric: {
    eventName: string;
    aggregation: typeof aggregations[number];
    direction: typeof directions[number];
  };
  rolloutPercent: number;
  // Variant percentages in variant order, followed by the control remainder.
  variationSplit: number[];
  hypothesis: { change: string; metric: string; expectedEffect: string; timeframe: string };
  environment: string;
  appPath: string;
}

export interface PlannerContext {
  appPath?: string;
  flagName?: string;
  eventName?: string;
  guided?: boolean;
}

function object(properties: Record<string, object>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const string = { type: "string", minLength: 1 };
const percent = { type: "number", minimum: 0, maximum: 100 };
const variantSchema = object({ key: string, label: string, value: string });
const metricSchema = object({
  eventName: string,
  aggregation: { type: "string", enum: aggregations },
  direction: { type: "string", enum: directions },
});
const hypothesisSchema = object({ change: string, metric: string, expectedEffect: string, timeframe: string });
const schema = object({
  flagName: { ...string, pattern: slugPattern },
  variants: { type: "array", items: variantSchema, minItems: 1 },
  metric: metricSchema,
  rolloutPercent: percent,
  variationSplit: { type: "array", items: percent },
  hypothesis: hypothesisSchema,
  environment: string,
  appPath: string,
});

function hasFields(value: unknown, { required }: ReturnType<typeof object>): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === required.length
    && required.every((field) => Object.hasOwn(value, field));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function percentage(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 100;
}

export function containsCredential(value: object): boolean {
  const json = JSON.stringify(value);
  return [
    process.env.TOGGLEPILOT_LLM_API_KEY,
    process.env.FLAGSMITH_API_KEY,
    process.env.FLAGSMITH_ENVIRONMENT_KEY,
  ].some((secret) => secret && json.includes(JSON.stringify(secret).slice(1, -1)));
}

export function isExperimentPlan(value: unknown): value is ExperimentPlan {
  if (!hasFields(value, schema)) return false;
  const { flagName, variants, metric, rolloutPercent, variationSplit, hypothesis, environment, appPath } = value;
  return nonEmpty(flagName) && slug.test(flagName) && flagName === flagName.trim()
    && Array.isArray(variants) && variants.length >= 1
    && Array.from(variants).every((variant: unknown) => hasFields(variant, variantSchema)
      && nonEmpty(variant.key) && variant.key.trim().toLowerCase() !== "control"
      && nonEmpty(variant.label) && nonEmpty(variant.value))
    && new Set(variants.map(({ key }) => key.trim())).size === variants.length
    && hasFields(metric, metricSchema) && nonEmpty(metric.eventName)
    && aggregations.some((aggregation) => aggregation === metric.aggregation)
    && directions.some((direction) => direction === metric.direction)
    && percentage(rolloutPercent)
    && Array.isArray(variationSplit) && variationSplit.length === variants.length + 1
    && Array.from(variationSplit).every(percentage)
    && Math.abs(variationSplit.reduce((total, share) => total + share, 0) - 100) < 1e-9
    && hasFields(hypothesis, hypothesisSchema)
    && Object.values(hypothesis).every(nonEmpty)
    && nonEmpty(environment) && nonEmpty(appPath);
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function defaults(sentence: string, context: PlannerContext): ExperimentPlan {
  const description = sentence.replace(/^test whether\s+/i, "").replace(/[.?!]+$/, "");
  const change = description.split(/\s+(?:lifts?|increases?|decreases?|reduces?|improves?|converts?)\b/i)[0];
  const eventName = context.eventName
    ?? (/\bclicks?\b/i.test(description) ? "cta_clicked"
      : /\bdemo bookings?\b/i.test(description) ? "demo_booked"
      : /\bsign[ -]?up\b/i.test(description) ? "signup_completed" : "conversion");
  const lower = /\b(?:decreases?|reduces?)\b/i.test(description);
  const key = toSlug(change);
  return {
    flagName: context.flagName ?? (key || "experiment"),
    variants: [
      { key: key && key !== "control" && key !== "alternate" ? key : "proposed", label: change, value: change },
    ],
    metric: { eventName, aggregation: "occurrence", direction: lower ? "lower" : "higher" },
    rolloutPercent: 100,
    variationSplit: [50, 50],
    hypothesis: { change, metric: eventName, expectedEffect: lower ? "decrease by at least 10%" : "increase by at least 10%", timeframe: "30 days" },
    environment: "Production",
    appPath: context.appPath ?? ".",
  };
}

async function draftWithLlm(sentence: string, context: PlannerContext, plan: ExperimentPlan): Promise<ExperimentPlan | undefined> {
  const { TOGGLEPILOT_LLM_API_KEY: key, TOGGLEPILOT_LLM_BASE_URL: baseUrl, TOGGLEPILOT_LLM_MODEL: model } = process.env;
  if (!key || !baseUrl || !model) return;

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Draft an experiment plan. Preserve explicitly supplied context values. "
              + "The flag's own value is the control, so never use control as a variant key. "
              + "Use one variant and a 50/50 split by default. Honor explicit requests for more variants or a different split. "
              + "List one split percentage per variant in order, then the control remainder, totaling 100. "
              + "Write separate hypothesis parts for the change, metric, expected effect, and timeframe. "
              + "Use an environment name, never a credential.",
          },
          { role: "user", content: JSON.stringify({ sentence, context, defaults: plan }) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "experiment_plan", strict: true, schema } },
      }),
    });
    if (!response.ok) return;
    const result = await response.json() as { choices: { message: { content: string } }[] };
    const content = result.choices[0].message.content.trim()
      .replace(/^```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n[^\S\r\n]*```$/i, "$1");
    let draft: unknown;
    try {
      draft = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start === -1 || end <= start) return;
      draft = JSON.parse(content.slice(start, end + 1));
    }
    if (isExperimentPlan(draft) && !containsCredential(draft)
      && (context.flagName === undefined || draft.flagName === context.flagName)
      && (context.appPath === undefined || draft.appPath === context.appPath)
      && (context.eventName === undefined || draft.metric.eventName === context.eventName)) return draft;
  } catch {
    // Provider failures use the same guided flow as an invalid draft.
  }
}

async function guidedPlan(plan: ExperimentPlan, context: PlannerContext, prompt: ReturnType<typeof createPrompt>): Promise<ExperimentPlan> {
  async function ask(label: string, fallback: string): Promise<string> {
    console.log(`${label} [${fallback}]`);
    const value = await prompt.read();
    if (value && containsCredential({ answer: value })) throw new Error("Remove credentials from the experiment inputs.");
    return value?.trim() || fallback;
  }

  console.log("Guided planning. Press Enter to accept each default.");
  plan.appPath = context.appPath ?? await ask("App path", plan.appPath);
  plan.flagName = context.flagName ?? await ask("Flag name", plan.flagName);
  plan.environment = await ask("Environment name", plan.environment);
  const count = Number(await ask("Number of variants", String(plan.variants.length)));
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Enter a whole number of variants of at least 1.");
  for (let index = 0; index < count; index++) {
    const label = `Variant ${index + 1}`;
    const variant = plan.variants[index] ?? { key: toSlug(label), label, value: label };
    plan.variants[index] = {
      key: await ask(`${label} key`, variant.key),
      label: await ask(`${label} label`, variant.label),
      value: await ask(`${label} value`, variant.value),
    };
  }

  plan.metric.eventName = context.eventName ?? await ask("Metric event", plan.metric.eventName);
  const aggregation = await ask("Aggregation (occurrence/count/sum/mean)", plan.metric.aggregation);
  const direction = await ask("Direction (higher/lower/informational)", plan.metric.direction);
  plan.rolloutPercent = Number(await ask("Rollout percent", String(plan.rolloutPercent)));
  const shares = Array<number>(count).fill(Math.floor(50 / count));
  const split = (await ask("Variant percentages in order (comma-separated, control gets the remainder)", shares.join(",")))
    .split(",").map((share) => share.trim() === "" ? NaN : Number(share));
  plan.variationSplit = [...split, 100 - split.reduce((total, share) => total + share, 0)];
  plan.hypothesis.change = await ask("Hypothesis change", plan.hypothesis.change);
  plan.hypothesis.metric = await ask("Hypothesis metric", plan.metric.eventName);
  plan.hypothesis.expectedEffect = await ask("Hypothesis expected effect", plan.hypothesis.expectedEffect);
  plan.hypothesis.timeframe = await ask("Hypothesis timeframe", plan.hypothesis.timeframe);

  const draft = { ...plan, metric: { ...plan.metric, aggregation, direction } };
  if (!isExperimentPlan(draft) || containsCredential(draft)) throw new Error("Guided answers did not form a valid experiment plan.");
  return draft;
}

export async function planExperiment(sentence: string, context: PlannerContext = {}, prompt?: ReturnType<typeof createPrompt>): Promise<ExperimentPlan> {
  if (!sentence.trim()) throw new Error("Provide an experiment sentence.");
  const plan = defaults(sentence.trim(), context);
  if (containsCredential({ sentence, plan })) throw new Error("Remove credentials from the experiment inputs.");
  const draft = context.guided ? undefined : await draftWithLlm(sentence, context, plan);
  if (draft) return draft;
  const input = prompt ?? createPrompt();
  try {
    return await guidedPlan(plan, context, input);
  } finally {
    if (!prompt) input.close();
  }
}
