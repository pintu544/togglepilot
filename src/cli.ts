#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { requireCredentials } from "./credentials";
import { executePlan } from "./executor";
import { approvalGate } from "./gate";
import { createPrompt } from "./prompt";
import { appendExecutionRecord, saveRunRecord } from "./record";
import { readResults } from "./results";
import { rollout } from "./rollout";
import { containsCredential, isExperimentPlan, planExperiment, type ExperimentPlan, type PlannerContext } from "./planner";
import { generateInstrumentationSnippet } from "./snippet";
import { formatPreflightReport, runPreflightChecks } from "./validator";

const USAGE = `TogglePilot — describe an A/B test in one sentence; it validates, plans,
gets your approval, launches it on Flagsmith, and tells you the winner.

Usage:
  togglepilot run <sentence> [--app-path <path>]
                                Plan, run pre-flight checks, and review
  togglepilot run --plan-file <path> [--app-path <path>]
                                Validate and review a saved JSON plan
  togglepilot run <sentence> --plan-only [--guided] [--app-path <path>]
                              [--flag <name>] [--metric-event <event>]
  togglepilot results [--experiment-id <id>] [--refresh]
                                Plain-English readout of the experiment's results
  togglepilot rollout [--experiment-id <id>] [--dry-run]
                                Recommend and (on approval) roll out the winner
  togglepilot --help             Show this help

Credentials (environment variables only, see .env.example):
  FLAGSMITH_API_KEY              Management API key
  FLAGSMITH_ENVIRONMENT_KEY      Client-side environment key for the target environment`;

function redact(message: string): string {
  for (const secret of [
    process.env.FLAGSMITH_API_KEY,
    process.env.FLAGSMITH_ENVIRONMENT_KEY,
    process.env.TOGGLEPILOT_LLM_API_KEY,
  ]) {
    if (!secret) continue;
    message = message.replaceAll(secret, "[redacted]")
      .replaceAll(JSON.stringify(secret).slice(1, -1), "[redacted]");
  }
  return message;
}

function printOutput(message: string, write = console.log): void {
  write(redact(message));
}

async function readPlanFile(path: string): Promise<ExperimentPlan> {
  const json = await readFile(path, "utf8").catch(() => {
    throw new Error("Could not read the plan file. Check the --plan-file path.");
  });
  let plan: ExperimentPlan;
  try {
    plan = JSON.parse(json);
  } catch {
    throw new Error("The plan file is not valid JSON.");
  }
  if (!plan || !Array.isArray(plan.variants) || typeof plan.metric?.eventName !== "string"
    || !plan.hypothesis || !Array.isArray(plan.variationSplit)) {
    throw new Error("The plan file must contain variants, a metric event name, a hypothesis and a variation split.");
  }
  return plan;
}

async function run(args: string[]): Promise<void> {
  const startedAt = new Date();
  const context: PlannerContext = {};
  let sentence: string | undefined;
  let planFile: string | undefined;
  let planOnly = false;
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (!option.startsWith("--")) {
      if (sentence !== undefined) throw new Error("Provide a single experiment sentence.");
      sentence = option;
      continue;
    }
    if (option === "--plan-only") {
      planOnly = true;
      continue;
    }
    if (option === "--guided") {
      context.guided = true;
      continue;
    }
    const value = args[++index];
    if (!value?.trim() || value.startsWith("--")) throw new Error("Planning options require a value.");
    switch (option) {
      case "--app-path": context.appPath = value; break;
      case "--plan-file": planFile = value; break;
      case "--flag": context.flagName = value; break;
      case "--metric-event": context.eventName = value; break;
      default: throw new Error("Unknown planning option. See togglepilot --help.");
    }
  }

  if (planFile && sentence !== undefined) throw new Error("Use either --plan-file or an experiment sentence.");
  if (planFile && planOnly) throw new Error("--plan-file runs pre-flight checks and cannot be combined with --plan-only.");
  if (!planFile && !sentence) throw new Error("Provide an experiment sentence or --plan-file.");

  if (planOnly) {
    const plan = await planExperiment(sentence!, context);
    printPlan(plan, generateInstrumentationSnippet(plan));
    return;
  }

  requireCredentials("run");
  const prompt = createPrompt();
  try {
    const plan = planFile ? await readPlanFile(planFile) : await planExperiment(sentence!, context, prompt);
    if (containsCredential(plan)) throw new Error("Remove credentials from the experiment inputs.");
    const snippet = generateInstrumentationSnippet(plan);
    const preflight = {
      appPath: context.appPath ?? plan.appPath ?? ".",
      environmentKey: process.env.FLAGSMITH_ENVIRONMENT_KEY!,
      apiKey: process.env.FLAGSMITH_API_KEY!,
    };
    const report = await runPreflightChecks(plan, snippet, preflight);
    printOutput(formatPreflightReport(report));
    if (report.some(({ status }) => status === "fail")) {
      console.error("Pre-flight failed — nothing was created.");
      process.exitCode = 1;
      return;
    }
    if (!isExperimentPlan(plan)) throw new Error("Invalid experiment plan — nothing was created.");

    printPlan(plan, snippet);
    console.log("All pre-flight checks passed.");
    const outcome = await approvalGate({ plan, report }, { prompt, preflight, print: printOutput, printPlan });
    const directory = await saveRunRecord(outcome, startedAt, new Date(), redact);
    if (outcome.decision === "approved") {
      console.log("Approved.");
      const result = await executePlan(outcome.plan, {
        ...preflight,
        appPath: context.appPath ?? outcome.plan.appPath,
        projectId: Number(process.env.FLAGSMITH_PROJECT_ID ?? 55638),
      });
      if (!result.ok) {
        printOutput(`${result.step}: ${result.error}`, console.error);
        process.exitCode = 1;
      }
      await appendExecutionRecord(directory, result, redact);
      if (result.ok) {
        for (const [kind, { id, action }] of Object.entries(result.objects)) {
          console.log(`${kind} ID ${id} (${action}).`);
        }
        console.log("Experiment created (not started).");
      }
    } else {
      console.log("Rejected — nothing was created.");
    }
    printOutput(`Run record saved to ${directory}.`);
  } finally {
    prompt.close();
  }
}

function printPlan(plan: ExperimentPlan, snippet: string): void {
  const { change, metric, expectedEffect, timeframe } = plan.hypothesis;
  printOutput(`\nExperiment plan for ${plan.flagName} in ${plan.environment} (${plan.appPath})`);
  printOutput(`Metric: ${plan.metric.eventName} (${plan.metric.aggregation}, ${plan.metric.direction})`);
  printOutput(`Rollout: ${plan.rolloutPercent}%`);
  for (const [index, variant] of plan.variants.entries()) {
    printOutput(`  ${variant.label} (${variant.key}): ${plan.variationSplit[index]}%`);
  }
  printOutput(`  Control: ${plan.variationSplit.at(-1)}%`);
  printOutput(`Hypothesis: ${change} will cause ${metric} to ${expectedEffect} within ${timeframe}.\n`);
  printOutput(JSON.stringify(plan, null, 2));
  printOutput("\n--- Instrumentation snippet (paste into the host app) ---");
  printOutput(snippet);
}

function experimentCredentials(requestedId?: string) {
  const id = requestedId ?? process.env.TOGGLEPILOT_EXPERIMENT_ID ?? "590";
  const experimentId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(experimentId)) {
    throw new Error("Provide a positive integer experiment ID.");
  }
  const apiKey = process.env.FLAGSMITH_API_KEY;
  const environmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY;
  if (!apiKey || !environmentKey) {
    throw new Error("Set FLAGSMITH_API_KEY and FLAGSMITH_ENVIRONMENT_KEY to read experiment results.");
  }
  return { experimentId, apiKey, environmentKey };
}

async function runRollout(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { "experiment-id": { type: "string" }, "dry-run": { type: "boolean" } },
  });
  const prompt = createPrompt();
  try {
    await rollout({
      ...experimentCredentials(values["experiment-id"]),
      dryRun: values["dry-run"] ?? false,
      print: printOutput, prompt, redact,
    });
  } finally {
    prompt.close();
  }
}

async function results(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { "experiment-id": { type: "string" }, refresh: { type: "boolean" } },
  });
  const credentials = experimentCredentials(values["experiment-id"]);
  const disclosure = (await readFile(join(__dirname, "../docs/seeded-cohort-disclosure.md"), "utf8")).trim();
  printOutput(await readResults({
    ...credentials, refresh: values.refresh ?? false, disclosure, redact,
  }));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "run":
      await run(args);
      break;
    case "results":
      await results(args);
      break;
    case "rollout":
      await runRollout(args);
      break;
    case "--help":
    case "-h":
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown subcommand: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

void main().catch((error: unknown) => {
  printOutput(error instanceof Error ? error.message : "Planning failed.", console.error);
  process.exitCode = 1;
});
