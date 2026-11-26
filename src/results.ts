import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

type Counts = { n: number; sum: number };
type Inference = { lift: number; ci_low: number; ci_high: number; chance_to_win: number };
type Series = { points: { new_identities: Record<string, number> }[] };
type Metric = { metric: number; metric_name: string; aggregation: string; direction?: string };
type Experiment = {
  status: string;
  started_at: string | null;
  metrics: Metric[];
  feature: { multivariate_options: { id: number; key?: string | null }[] };
  experiment_rollout?: {
    multivariate_feature_state_values: { multivariate_feature_option: number; percentage_allocation: number }[];
  } | null;
};
type MetricResult = {
  metric_id: number;
  variants: Record<string, Counts>;
  inference?: Record<string, Inference | null>;
};

type Computation<T> = { as_of: string | null; payload: T | null; is_final?: boolean };
type Snapshot = {
  experiment: Experiment;
  results: Computation<{
    metrics: MetricResult[];
    srm_p_value: number | null;
    exposures_timeseries?: Series;
  }> | null;
  exposures: Computation<{ timeseries: Series }> | null;
};
type CacheEntry = { fetched_at: number; response: Snapshot };
const TTL = 5 * 60_000;
const CONTROL = "control";
const timestamp = (time: number) => new Date(time).toISOString();

function posterior({ n, sum }: Counts) {
  const total = n + 2;
  const mean = (sum + 1) / total;
  return { mean, variance: mean * (1 - mean) / (total + 1) };
}

// Normal CDF approximation (Abramowitz and Stegun 26.2.17).
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const tail = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)
    * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z < 0 ? tail : 1 - tail;
}

export function estimateOccurrence(control: Counts, variant: Counts, direction = "up"): Inference {
  const c = posterior(control);
  const v = posterior(variant);
  const ratio = v.mean / c.mean;
  const margin = 1.95996398454 * Math.sqrt(v.variance + ratio * ratio * c.variance) / c.mean;
  const z = (v.mean - c.mean) / Math.sqrt(v.variance + c.variance);
  return {
    lift: ratio - 1,
    ci_low: Math.max(-1, ratio - 1 - margin),
    ci_high: ratio - 1 + margin,
    chance_to_win: normalCdf(direction === "down" ? -z : z),
  };
}

function exposuresByArm(series?: Series): Record<string, number> {
  const totals: Record<string, number> = Object.create(null);
  for (const point of series?.points ?? []) {
    for (const [key, n] of Object.entries(point.new_identities)) totals[key] = (totals[key] ?? 0) + n;
  }
  return totals;
}

const pct = (fraction: number) => `${+(fraction * 100).toFixed(2)}%`;
const count = (value: number | undefined) => value ?? "unavailable";

export function renderResults(id: number, { response, fetched_at }: CacheEntry, disclosure: string, cacheNotice: string): string {
  const { experiment, results, exposures } = response;
  const payload = results?.payload;
  const lines = [
    `Experiment ${id} results`,
    `As of ${results?.as_of ?? `${timestamp(fetched_at)} (API read time, no results timestamp available)`}.`,
    cacheNotice,
  ];
  const resultExposures = exposuresByArm(payload?.exposures_timeseries);
  const liveExposures = exposuresByArm(exposures?.payload?.timeseries);
  const options = experiment.feature.multivariate_options;
  const configured = new Map<string, number>();
  for (const arm of experiment.experiment_rollout?.multivariate_feature_state_values ?? []) {
    const key = options.find(({ id }) => id === arm.multivariate_feature_option)?.key;
    if (key) configured.set(key, arm.percentage_allocation);
  }
  if (experiment.experiment_rollout) configured.set(CONTROL, 100 - [...configured.values()].reduce((sum, n) => sum + n, 0));
  const srm = payload?.srm_p_value != null && payload.srm_p_value < 0.001;
  if (srm) {
    lines.push("Sample Ratio Mismatch (SRM). Don't act on the results.");
    const observed = Object.entries(resultExposures).length
      ? Object.entries(resultExposures)
      : Object.entries(payload?.metrics[0]?.variants ?? {}).map(([key, { n }]) => [key, n] as const);
    const total = observed.reduce((sum, [, n]) => sum + n, 0);
    lines.push(`Observed split: ${total ? observed.map(([key, n]) => `${key} ${pct(n / total)}`).join(", ") : "unavailable"}.`);
    lines.push(`Configured split: ${configured.size ? [...configured].map(([key, n]) => `${key} ${pct(n / 100)}`).join(", ") : "unavailable"}.`);
  }
  if (!payload) {
    lines.push(results === null
      ? 'Collecting data. Flagsmith returned {"results":null}.'
      : "Collecting data. Flagsmith has no computed results payload yet.");
  }

  for (const metric of experiment.metrics) {
    const result = payload?.metrics.find(({ metric_id }) => metric_id === metric.metric);
    const occurrence = metric.aggregation === "occurrence";
    const keys = new Set([
      CONTROL, ...options.flatMap(({ key }) => key ? [key] : []),
      ...Object.keys(result?.variants ?? {}), ...Object.keys(resultExposures), ...Object.keys(liveExposures),
    ]);
    const missing: string[] = [];
    lines.push(metric.metric_name);
    for (const key of keys) {
      const arm = result?.variants[key];
      const enrolled = arm?.n ?? resultExposures[key] ?? liveExposures[key];
      const conversions = occurrence ? arm?.sum : undefined;
      lines.push(`  ${key}: ${count(enrolled)} identities enrolled, ${occurrence
        ? `${count(conversions)} conversions` : `${count(arm?.sum)} total (${metric.aggregation} metric)`}.`);
      if (enrolled === undefined || enrolled < 50) missing.push(`${key} needs ${enrolled === undefined ? "at least 50 identities (count unavailable)" : `${50 - enrolled} more identities`}`);
      if (occurrence && (conversions === undefined || conversions < 5)) missing.push(`${key} needs ${conversions === undefined ? "at least 5 conversions (count unavailable)" : `${5 - conversions} more conversions`}`);
    }
    if (missing.length || !result) {
      if (missing.length) lines.push(`  Collecting data. ${missing.join(", ")}.`);
      else if (payload) lines.push("  Collecting data. Metric results are unavailable.");
      continue;
    }

    for (const key of keys) {
      if (key === CONTROL) continue;
      const reported = Object.hasOwn(result.inference ?? {}, key) ? result.inference?.[key] : undefined;
      const control = result.variants[CONTROL];
      const variant = result.variants[key];
      const canEstimate = occurrence && [control, variant].every((arm) =>
        arm && Number.isSafeInteger(arm.sum) && arm.sum >= 0 && arm.sum <= arm.n);
      const estimated = reported === undefined && canEstimate
        ? estimateOccurrence(control, variant, metric.direction) : undefined;
      const stats = reported ?? estimated;
      if (!stats) {
        lines.push(`  ${key}: Collecting data. Flagsmith inference is unavailable.`);
        continue;
      }
      lines.push(`  ${key} (${reported ? "Flagsmith" : "TogglePilot Bayesian estimate"}): Lift vs control ${pct(stats.lift)}, 95% credible interval ${pct(stats.ci_low)} to ${pct(stats.ci_high)}, Chance to beat control ${pct(stats.chance_to_win)}.`);
      if (srm) continue;
      if (stats.chance_to_win > 0.95) lines.push(`  ${key}: Winning. Roll out the winner.`);
      else if (stats.chance_to_win < 0.05) lines.push(`  ${key}: Losing. Stop this variation.`);
      else lines.push(`  ${key}: Inconclusive. Keep running.`);
    }
  }
  return [...lines, disclosure].join("\n");
}

type ReadOptions = {
  experimentId: number;
  apiKey: string;
  environmentKey: string;
  refresh: boolean;
  disclosure: string;
  redact: (message: string) => string;
  cachePath?: string;
  now?: () => number;
  fetchImpl?: typeof fetch;
};

export async function readResults({
  experimentId, apiKey, environmentKey, refresh, disclosure, redact,
  cachePath = "runs/.results-cache.json", now = Date.now, fetchImpl = fetch,
}: ReadOptions): Promise<string> {
  const host = (process.env.FLAGSMITH_API_URL ?? "https://api.flagsmith.com").replace(/\/+$/, "");
  const base = `${host}/api/v1/environments/${encodeURIComponent(environmentKey)}/experiments/${experimentId}/`;
  const key = createHash("sha256").update(base).digest("hex");
  const lock = `${cachePath}.lock`;
  const directory = join(cachePath, "..");
  await mkdir(directory, { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("The results cache is locked by another read. Try again when it finishes.");
    }
    throw error;
  }

  async function request<T>(path: string, step: string, method = "GET"): Promise<T> {
    try {
      const response = await fetchImpl(base + path, {
        method,
        headers: { Authorization: `Api-Key ${apiKey}`, ...(method === "POST" && { "Content-Type": "application/json" }) },
        body: method === "POST" ? "{}" : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`.trim());
      return (method === "POST" ? undefined : JSON.parse(redact(await response.text()))) as T;
    } catch (error) {
      throw new Error(redact(`${step} for experiment ${experimentId} failed. ${String(error)}`));
    }
  }

  try {
    const cache = await readFile(cachePath, "utf8").then(
      (json) => JSON.parse(json) as Record<string, CacheEntry>,
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
        return {} as Record<string, CacheEntry>;
      },
    );
    const prior = cache[key];
    if (prior && now() < prior.fetched_at + TTL) {
      const next = timestamp(prior.fetched_at + TTL);
      const notice = refresh ? "Refresh refused within the five-minute window. Showing cached response." : "Showing cached response.";
      return renderResults(experimentId, prior, disclosure, `${notice} Fresh read available at ${next}.`);
    }

    // OpenAPI https://api.flagsmith.com/api/v1/docs/
    // GET https://api.flagsmith.com/api/v1/environments/{environment_api_key}/experiments/{experiment_id}/results/
    const [experiment, { results }, { exposures }] = await Promise.all([
      request<Experiment>("", "Read experiment"),
      request<Pick<Snapshot, "results">>("results/", "Read results"),
      request<Pick<Snapshot, "exposures">>("exposures/", "Read exposures"),
    ]);
    const entry = { fetched_at: now(), response: { experiment, results, exposures } };
    const next = timestamp(entry.fetched_at + TTL);
    const notice = [`Fetched from Flagsmith. Fresh read available at ${next}.`];
    cache[key] = entry;
    const temp = join(lock, "cache.json");
    await writeFile(temp, JSON.stringify(cache), { mode: 0o600 });
    await rename(temp, cachePath);

    if (refresh && experiment.started_at && !results?.is_final) {
      // POST results/refresh/ queues asynchronous computation. The GET above is the latest available snapshot.
      await request("results/refresh/", "Request results computation", "POST");
      notice.push("Flagsmith accepted the computation request. The readout shows the available snapshot.");
    } else if (refresh) {
      notice.push("Flagsmith computation is available after start and before results are final.");
    }

    return renderResults(experimentId, entry, disclosure, notice.join(" "));
  } finally {
    // The temporary file can remain if the atomic rename failed.
    await rm(lock, { recursive: true, force: true });
  }
}
