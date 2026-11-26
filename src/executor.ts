import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ExperimentPlan } from "./planner";

interface ExecutorContext {
  apiKey: string;
  environmentKey: string;
  projectId: number;
  appPath: string;
  fetchImpl?: typeof fetch;
  spawnImpl?: (command: string, args: string[], options: SpawnSyncOptionsWithStringEncoding) => SpawnSyncReturns<string>;
}

type ObjectKind = "flag" | "metric" | "experiment";
interface ExecutionObject {
  id: number;
  action: "created" | "reused";
  verified: boolean;
}

interface ExecutionProgress {
  calls: string[];
  objects: Partial<Record<ObjectKind, ExecutionObject>>;
}

export type ExecutionResult = ExecutionProgress & (
  | { ok: true; objects: Record<ObjectKind, ExecutionObject> }
  | { ok: false; step: string; error: string }
);

interface Identified { id: number }
interface Flag extends Identified {
  name: string;
  variants?: { id: number; key?: string; value: unknown }[];
}
interface Metric extends Identified {
  definition?: { event?: string };
}
interface Allocation {
  multivariate_feature_option: number;
  percentage_allocation: number;
}
interface Experiment extends Identified {
  feature: number | Identified;
  metrics: { metric: number; expected_direction: string }[];
  status: string;
  experiment_rollout: {
    enabled: boolean;
    rollout_percentage: number;
    feature_state_value: { type: string; value: string };
    multivariate_feature_state_values: Allocation[];
  };
}

function requireMatch(expected: unknown, actual: unknown): void {
  if (!isDeepStrictEqual(expected, actual)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function readId(value: Identified | undefined): number {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0) {
    throw new Error(`Expected a positive integer ID, got ${JSON.stringify(value?.id)}.`);
  }
  return value.id;
}

const byKey = (a: { key?: string }, b: { key?: string }) => (a.key ?? "").localeCompare(b.key ?? "");
const byOption = (a: Allocation, b: Allocation) => a.multivariate_feature_option - b.multivariate_feature_option;

export async function executePlan(plan: ExperimentPlan, context: ExecutorContext): Promise<ExecutionResult> {
  const { apiKey, environmentKey, projectId, appPath, fetchImpl = fetch, spawnImpl = spawnSync } = context;
  const base = (process.env.FLAGSMITH_API_URL ?? "https://api.flagsmith.com").replace(/\/+$/, "");
  const environment = `${base}/api/v1/environments/${encodeURIComponent(environmentKey)}/`;
  const metricsUrl = `${environment}experiment-metrics/`;
  const experimentsUrl = `${environment}experiments/`;
  const localCli = join(homedir(), ".local", "bin", "flagsmith");
  const command = existsSync(localCli) ? localCli : "flagsmith";
  const calls: string[] = [];
  const objects: ExecutionProgress["objects"] = {};
  let step = "List flags";

  function cli<T>(args: string[]): T | undefined {
    calls.push(step);
    const result = spawnImpl(command, [
      "feature", ...args, "--project", String(projectId), "--api-url", base, "--json", "--no-input",
    ], {
      cwd: appPath,
      env: { ...process.env, FLAGSMITH_API_KEY: apiKey },
      encoding: "utf8",
      timeout: 15_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(result.stderr.trimEnd() || result.stdout.trimEnd() || `Flagsmith CLI exited with ${result.status ?? result.signal}.`);
    }
    return result.stdout.trim() ? JSON.parse(result.stdout) as T : undefined;
  }

  async function request<T>(url: string, payload?: object): Promise<T> {
    calls.push(step);
    const response = await fetchImpl(url, {
      method: payload ? "POST" : "GET",
      headers: { Authorization: `Api-Key ${apiKey}`, ...(payload && { "Content-Type": "application/json" }) },
      body: payload && JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
    return await response.json() as T;
  }

  try {
    const flags = cli<Flag[]>(["list", "--include-archived"]);
    if (!flags) throw new Error("Expected a flag list from the CLI.");
    const existingFlag = flags.find(({ name }) => name === plan.flagName);
    if (!existingFlag) {
      step = "Create flag";
      if (projectId === 55638 && plan.flagName === "headline_cta") {
        throw new Error("The protected baseline flag was missing from the flag list.");
      }
    }
    const flagId = readId(existingFlag ?? cli<Flag>(["create", plan.flagName, "--value", "control", "--enabled"]));
    const flag: ExecutionObject = objects.flag = { id: flagId, action: existingFlag ? "reused" : "created", verified: false };
    if (!existingFlag && flagId === 304978) throw new Error("Flag creation returned the protected baseline flag ID.");
    step = "Verify flag";
    const getFlag = ["get", String(flagId)];
    const currentFlag = cli<Flag>(getFlag);
    requireMatch({ id: flagId, name: plan.flagName }, { id: currentFlag?.id, name: currentFlag?.name });
    const missingVariants = plan.variants.flatMap(({ key, value }, index) => {
      const existingVariant = currentFlag?.variants?.find((variant) => variant.key === key);
      if (!existingVariant) return [{ key, value, weight: plan.variationSplit[index] }];
      requireMatch({ key, value }, { key, value: existingVariant.value });
      return [];
    });
    for (const { key, value, weight } of missingVariants) {
      step = `Create flag variant ${key}`;
      if (flagId === 304978) {
        throw new Error("Cannot add a variant to the protected baseline flag.");
      }
      cli(["variant", "add", String(flagId), "--key", key, `--value=${value}`, "--type", "string", "--weight", String(weight)]);
    }
    step = "Verify flag";
    const flagRead = cli<Flag>(getFlag);
    requireMatch({ id: flagId, name: plan.flagName }, { id: flagRead?.id, name: flagRead?.name });
    const variants = flagRead?.variants ?? [];
    requireMatch(plan.variants.map(({ key, value }) => ({ key, value })).sort(byKey),
      variants.map(({ key, value }) => ({ key, value })).sort(byKey));
    const allocations = plan.variants.map(({ key }, index) => ({
      multivariate_feature_option: readId(variants.find((variant) => variant.key === key)!),
      percentage_allocation: plan.variationSplit[index],
    })).sort(byOption);
    flag.verified = true;

    step = "List metrics";
    const event = plan.metric.eventName;
    let existingMetric: Metric | undefined;
    let url: string | undefined = metricsUrl;
    while (url && !existingMetric) {
      const page: Metric[] | { results: Metric[]; next?: string } = await request(url);
      existingMetric = (Array.isArray(page) ? page : page.results).find(({ definition }) => definition?.event === event);
      const next: string | undefined = Array.isArray(page) ? undefined : page.next;
      if (next) {
        const nextUrl: URL = new URL(next, url);
        const listUrl = new URL(metricsUrl);
        if (nextUrl.origin !== listUrl.origin || nextUrl.pathname !== listUrl.pathname) {
          throw new Error("Unexpected metric pagination URL.");
        }
        url = nextUrl.href;
      } else {
        url = undefined;
      }
    }
    const directions = {
      higher: { metric: "up", experiment: "increase" },
      lower: { metric: "down", experiment: "decrease" },
      informational: { metric: "none", experiment: "none" },
    } as const;
    const direction = directions[plan.metric.direction];
    step = existingMetric ? "Verify metric" : "Create metric";
    const metricId = readId(existingMetric ?? await request<Metric>(metricsUrl, {
      name: event, aggregation: plan.metric.aggregation, direction: direction.metric,
      definition: { version: 1, event },
    }));
    const metric: ExecutionObject = objects.metric = { id: metricId, action: existingMetric ? "reused" : "created", verified: false };
    step = "Verify metric";
    const metricRead = existingMetric ?? await request<Metric>(`${metricsUrl}${metricId}/`);
    requireMatch({ id: metricId, event }, { id: metricRead.id, event: metricRead.definition?.event });
    metric.verified = true;

    const { change, metric: hypothesisMetric, expectedEffect, timeframe } = plan.hypothesis;
    const expected = {
      feature: flagId,
      metrics: [{ metric: metricId, expected_direction: direction.experiment }],
      experiment_rollout: {
        enabled: true,
        rollout_percentage: plan.rolloutPercent,
        feature_state_value: { type: "string", value: "control" },
        multivariate_feature_state_values: allocations,
      },
    };
    step = "Create experiment";
    const experimentId = readId(await request<Experiment>(experimentsUrl, {
      ...expected,
      name: `${plan.flagName}_experiment`,
      hypothesis: `${change} will cause ${hypothesisMetric} to ${expectedEffect} within ${timeframe}.`,
    }));
    const experiment: ExecutionObject = objects.experiment = { id: experimentId, action: "created", verified: false };
    step = "Verify experiment";
    const actual = await request<Experiment>(`${experimentsUrl}${experimentId}/`);
    const rollout = actual.experiment_rollout;
    requireMatch({ id: experimentId, status: "created", ...expected }, {
      id: actual.id,
      status: actual.status?.toLowerCase(),
      feature: typeof actual.feature === "object" ? actual.feature?.id : actual.feature,
      metrics: actual.metrics?.map(({ metric, expected_direction }) => ({ metric, expected_direction })),
      experiment_rollout: rollout && {
        enabled: rollout.enabled,
        rollout_percentage: rollout.rollout_percentage,
        feature_state_value: rollout.feature_state_value,
        multivariate_feature_state_values: rollout.multivariate_feature_state_values
          ?.map(({ multivariate_feature_option, percentage_allocation }) => ({
            multivariate_feature_option, percentage_allocation,
          })).sort(byOption),
      },
    });
    experiment.verified = true;
    return { ok: true, calls, objects: { flag, metric, experiment } };
  } catch (error) {
    return { ok: false, step, error: error instanceof Error ? error.message : String(error), calls, objects };
  }
}
