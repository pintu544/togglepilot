import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import type { ExperimentPlan } from "./planner";

interface PreflightEntry {
  check: string;
  status: "pass" | "fail";
  detail: string;
  fix: string;
}

export type PreflightReport = PreflightEntry[];

interface PreflightOptions {
  appPath: string;
  environmentKey: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

function pass(check: string, detail: string): PreflightEntry {
  return { check, status: "pass", detail, fix: "No fix needed." };
}

function fail(check: string, detail: string, fix: string): PreflightEntry {
  return { check, status: "fail", detail, fix };
}

async function checkWarehouse({ environmentKey, apiKey, fetchImpl = fetch }: PreflightOptions) {
  const check = "Warehouse connection";
  const fix = "Connect the managed warehouse for the environment first.";
  const base = (process.env.FLAGSMITH_API_URL ?? "https://api.flagsmith.com").replace(/\/+$/, "");
  try {
    const response = await fetchImpl(`${base}/api/v1/environments/${encodeURIComponent(environmentKey)}/warehouse-connections/`, {
      method: "GET",
      headers: { Authorization: `Api-Key ${apiKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 200) return fail(check, `The warehouse check returned HTTP ${response.status}.`, fix);
    const body: unknown = await response.json();
    if (Array.isArray(body) && body.length > 0) return pass(check, "The environment has a warehouse connection.");
    return fail(check, "The environment has no warehouse connections.", fix);
  } catch {
    return fail(check, "Could not read the environment's warehouse connections.", fix);
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function checkVariants(variants: ExperimentPlan["variants"]) {
  const check = "Variant keys and labels";
  const fix = "Give every variant a unique key, a label and a value. Use a key other than control.";
  if (!Array.isArray(variants) || variants.length === 0) return fail(check, "The plan has no variants.", fix);
  const keys = new Set<string>();
  const problems: string[] = [];
  for (const [index, variant] of variants.entries()) {
    const key = nonEmpty(variant?.key) ? variant.key.trim() : "";
    const missing = [
      !key && "key",
      !nonEmpty(variant?.label) && "label",
      !nonEmpty(variant?.value) && "value",
    ].filter(Boolean);
    const name = `Variant ${index + 1}`;
    if (missing.length) problems.push(`${name} is missing its ${missing.join(", ")}.`);
    if (key.toLowerCase() === "control") problems.push(`${name} uses the reserved control key.`);
    if (key && keys.has(key)) problems.push(`${name} repeats a variant key.`);
    if (key) keys.add(key);
  }
  return problems.length ? fail(check, problems.join(" "), fix)
    : pass(check, "Every variant has a unique key, a label and a value.");
}

function calls(file: string, source: string): { name: string; argument?: ts.Expression }[] {
  const found: { name: string; argument?: ts.Expression }[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
      if (ts.isIdentifier(name)) found.push({ name: name.text, argument: node.arguments[0] });
    }
    ts.forEachChild(node, visit);
  }

  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest));
  return found;
}

function collectEvents(file: string, source: string, events: Set<string>): boolean {
  let found = false;
  for (const { name, argument } of calls(file, source)) {
    if (name !== "trackEvent") continue;
    found = true;
    if (argument && ts.isStringLiteral(argument)) events.add(argument.text);
  }
  return found;
}

async function scanEvents(path: string, events: Set<string>): Promise<boolean> {
  let found = false;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      if (await scanEvents(child, events)) found = true;
    } else if (entry.isFile() && /\.[jt]sx?$/.test(entry.name)) {
      if (collectEvents(child, await readFile(child, "utf8"), events)) found = true;
    }
  }
  return found;
}

async function checkEvent(appPath: string, eventName: string, snippet: string) {
  const check = "Metric event name";
  const events = new Set<string>();
  let found: boolean;
  try {
    found = await scanEvents(appPath, events);
  } catch {
    return fail(check, "Could not read the target app source.", "Point --app-path at the app.");
  }
  if (!found) collectEvents("snippet.tsx", snippet, events);
  if (events.has(eventName)) {
    return pass(check, found ? "The app sends the exact metric event name."
      : "The app has no trackEvent calls. The generated snippet sends the exact metric event name.");
  }

  const expected = [...events].filter((event) => event.toLowerCase() === eventName?.toLowerCase());
  const names = (expected.length ? expected : [...events]).map((event) => JSON.stringify(event)).join(", ");
  return fail(check, "The metric event name does not exactly match a tracked event.",
    names ? `Set the metric event name to match exactly, including case. Expected ${names}.`
      : "Add a literal trackEvent call with the exact metric event name.");
}

function meetsMinimum(version: string, minimum: string): boolean {
  const normalized = version.trim().replace(/^(?:\^|~|>=)\s*/, "");
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) return false;
  const parts = normalized.split(".").map(Number);
  for (const [index, required] of minimum.split(".").map(Number).entries()) {
    if (parts[index] !== required) return parts[index] > required;
  }
  return true;
}

async function checkSdk(appPath: string) {
  const check = "Flagsmith SDK versions";
  let manifest: { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
  try {
    manifest = JSON.parse(await readFile(join(appPath, "package.json"), "utf8"));
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error();
  } catch {
    return fail(check, "Could not read a valid package.json for the target app.",
      "Point --app-path at the app and make sure it has a valid package.json.");
  }

  const problems: string[] = [];
  const fixes: string[] = [];
  for (const [name, minimum, optional] of [
    ["@flagsmith/flagsmith", "12.4.0", false],
    ["@flagsmith/nodejs", "9.1.0", true],
  ] as const) {
    const versions = [manifest.dependencies, manifest.devDependencies]
      .filter((section) => section && Object.hasOwn(section, name))
      .map((section) => section?.[name]);
    if (!versions.length && !optional) {
      problems.push(`${name} is missing. The app cannot send events without it.`);
      fixes.push(`Install ${name} at ${minimum} or later.`);
    }
    for (const version of versions) {
      if (typeof version === "string" && meetsMinimum(version, minimum)) continue;
      problems.push(`${name} is listed as ${typeof version === "string" ? version : "an invalid version"} and requires ${minimum} or later.`);
      fixes.push(`Set ${name} to ${minimum} or later in package.json.`);
    }
  }
  return problems.length ? fail(check, problems.join(" "), [...new Set(fixes)].join(" "))
    : pass(check, "The browser SDK and any listed Node SDK meet the minimum versions.");
}

function checkInstrumentation(snippet: string) {
  const check = "Instrumentation identity and event flushing";
  const names = new Set(calls("snippet.tsx", snippet).map(({ name }) => name));
  const missing = ["identify", "flushEvents"].filter((name) => !names.has(name));
  if (!missing.length) return pass(check, "The snippet identifies the user and flushes events.");
  const expected = missing.map((name) => `${name}()`).join(" and ");
  return fail(check, `The snippet is missing ${expected}.`, `Add the missing ${expected} call(s) to the instrumentation.`);
}

export async function runPreflightChecks(plan: ExperimentPlan, snippet: string, options: PreflightOptions): Promise<PreflightReport> {
  return Promise.all([
    checkWarehouse(options),
    checkVariants(plan.variants),
    checkEvent(options.appPath, plan.metric?.eventName, snippet),
    checkSdk(options.appPath),
    checkInstrumentation(snippet),
  ]);
}

export function formatPreflightReport(report: PreflightReport): string {
  return report.map(({ check, status, detail, fix }) => `${status.toUpperCase()} — ${check}. ${detail} ${fix}`).join("\n");
}
