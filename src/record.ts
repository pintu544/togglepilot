import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionResult } from "./executor";
import type { ApprovalOutcome } from "./gate";
import { formatPreflightReport } from "./validator";

export async function saveRunRecord(
  { plan, report, decision }: ApprovalOutcome,
  startedAt: Date,
  decidedAt: Date,
  redact: (message: string) => string,
): Promise<string> {
  await mkdir("runs", { recursive: true });
  let directory: string;
  for (let timestamp = decidedAt.getTime(); ; timestamp++) {
    directory = join("runs", new Date(timestamp).toISOString().replaceAll(":", "-"));
    try {
      await mkdir(directory);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }

  const { change, metric, expectedEffect, timeframe } = plan.hypothesis;
  const record = [
    "# TogglePilot run record",
    "",
    `- Started at: ${startedAt.toISOString()}`,
    `- Decided at: ${decidedAt.toISOString()}`,
    `- Gate decision: ${decision}`,
    "",
    "## Plan summary",
    "",
    `- Flag: ${plan.flagName}`,
    `- Environment: ${plan.environment}`,
    `- App path: ${plan.appPath}`,
    `- Metric: ${plan.metric.eventName} (${plan.metric.aggregation}, ${plan.metric.direction})`,
    `- Rollout: ${plan.rolloutPercent}%`,
    ...plan.variants.map((variant, index) =>
      `- ${variant.label} (${variant.key}): ${variant.value}, ${plan.variationSplit[index]}%`),
    `- Control: ${plan.variationSplit.at(-1)}%`,
    `- Hypothesis: ${change} will cause ${metric} to ${expectedEffect} within ${timeframe}.`,
    "",
    "## Pre-flight checks",
    "",
    ...formatPreflightReport(report).split("\n").map((line) => `- ${line}`),
    "",
    decision === "rejected" ? "Nothing was created." : "",
    "",
  ].join("\n");

  await writeFile(join(directory, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  await writeFile(join(directory, "run-record.md"), redact(record));
  return directory;
}

export async function appendExecutionRecord(
  directory: string,
  result: ExecutionResult,
  redact: (message: string) => string,
): Promise<void> {
  const record = [
    "## Execution",
    "",
    `- Finished at: ${new Date().toISOString()}`,
    ...result.calls.map((call) => `- CLI/API step: ${call}`),
    ...Object.entries(result.objects).map(([kind, object]) =>
      `- ${kind} ID ${object.id} (${object.action}, ${object.verified ? "verified" : "unverified"})`),
    result.ok ? "- Experiment created (not started)." : `- Failed step: ${result.step}\n- Error: ${result.error}`,
    "",
  ].join("\n");
  await appendFile(join(directory, "run-record.md"), redact(record));
}
