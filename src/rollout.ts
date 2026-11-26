import type { createPrompt } from "./prompt";
import { readResultsReport } from "./results";

type Options = Omit<Parameters<typeof readResultsReport>[0], "refresh" | "disclosure"> & {
  dryRun: boolean;
  print: (message: string) => void;
  prompt: ReturnType<typeof createPrompt>;
};

type FlagState = {
  environment_default: {
    enabled: boolean;
    value: { type: string; value: string } | null;
    variants: { id: number; weight: number }[];
  };
  segment_overrides: unknown[];
};

export async function rollout(options: Options): Promise<void> {
  const { experimentId, apiKey, environmentKey, print, prompt, dryRun, fetchImpl = fetch } = options;
  if (experimentId === 527) throw new Error("Experiment 527 is protected.");
  const report = await readResultsReport({ ...options, refresh: false, disclosure: "" }, true);
  print(report.output);
  if (report.srm) return;
  if (report.collecting || report.winners.size !== 1) {
    print("No conclusive winner. Keep running.");
    return;
  }

  const { experiment } = report;
  if (experiment.status !== "running" || !experiment.started_at || report.final) {
    print(`Rollout is unavailable for experiment ${experimentId} (status ${experiment.status}).`);
    return;
  }

  const [[key, stats]] = report.winners;
  const control = key === "control";
  const flagId = experiment.feature.id;
  const variants = experiment.feature.multivariate_options;
  const winner = variants.find((variant) => variant.key === key);
  const value = control ? "control" : winner?.string_value;
  if (experiment.id !== experimentId || !flagId || flagId === 304978
    || (experimentId === 590 && flagId !== 305212) || (!control && !winner) || value == null
    || (experimentId === 590 && !control && (key !== "Variant_1" || value !== "shorter_headline"))) {
    throw new Error("Resolve rollout target: unexpected experiment flag or winning variation.");
  }

  const decision = control
    ? { rollout_decision: "control" }
    : { rollout_decision: "variant", rollout_variant: winner!.id };

  // The Cloud OpenAPI schema lists POST /api/v1/environments/{key}/experiments/{id}/complete/.
  // Flagsmith applies the chosen weights, removes the experiment override and completes the
  // experiment in one transaction. Running experiments lock standalone flag updates.
  // GET /api/__future__/environments/{key}/features/{flag_id}/ reads the resulting served state.
  const base = (process.env.FLAGSMITH_API_URL ?? "https://api.flagsmith.com").replace(/\/+$/, "");
  const environment = encodeURIComponent(environmentKey);
  const experimentPath = `/api/v1/environments/${environment}/experiments/${experimentId}/`;
  const flagPath = `/api/__future__/environments/${environment}/features/${flagId}/`;

  print(`Recommend rolling out ${key} (${+(stats.chance_to_win * 100).toFixed(4)}% win probability, ${+(stats.lift * 100).toFixed(2)}% lift).`);
  print(`${dryRun ? "Dry run. Would set" : "Set"} flag ${flagId} to serve ${JSON.stringify(value)} to 100% and end experiment ${experimentId}.`);
  print(`POST /api/v1/environments/{environment_key}/experiments/${experimentId}/complete/ ${JSON.stringify(decision)}. Then re-read the flag and experiment.`);
  if (dryRun) return;

  print("Gate 3 — [A]pprove / [R]eject rollout");
  while (true) {
    const answer = (await prompt.read())?.trim().toLowerCase();
    if (answer === "a" || answer === "approve") break;
    if (answer === undefined || answer === "r" || answer === "reject") {
      print("Rejected — nothing changed.");
      return;
    }
    print("Enter A or R.");
  }

  async function request<T>(step: string, path: string, body?: object): Promise<T> {
    try {
      const response = await fetchImpl(base + path, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Api-Key ${apiKey}`, ...(body && { "Content-Type": "application/json" }) },
        body: body && JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
      return (body ? undefined : await response.json()) as T;
    } catch (error) {
      throw new Error(options.redact(`${step}: ${String(error)}`));
    }
  }

  await request("Update flag and end experiment", experimentPath + "complete/", decision);

  const flag = await request<FlagState>("Verify flag update", flagPath);
  const state = flag?.environment_default;
  if (state?.enabled !== true || flag.segment_overrides?.length !== 0
    || (control && (state.value?.type !== "string" || state.value.value !== value))
    || state.variants?.length !== variants.length
    || !variants.every(({ id }) => state.variants.some((variant) =>
      variant.id === id && variant.weight === (id === winner?.id && !control ? 100 : 0)))) {
    throw new Error(`Verify flag update: flag ${flagId} did not return the expected default and allocations, or still has segment overrides.`);
  }
  const ended = await request<{ id: number; status: string; ended_at: string | null; rollout_decision: string; rollout_variant: number | null }>(
    "Verify experiment ended", experimentPath,
  );
  if (ended?.id !== experimentId || ended.status !== "completed" || !ended.ended_at
    || ended.rollout_decision !== decision.rollout_decision || ended.rollout_variant !== (decision.rollout_variant ?? null)) {
    throw new Error(`Verify experiment ended: experiment ${experimentId} did not return the expected completed status and rollout decision.`);
  }
  print(`Verified flag ${flagId} serves ${JSON.stringify(value)} by default and experiment ${experimentId} ended.`);
}
