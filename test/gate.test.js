const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { closeSync, openSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Readable } = require("node:stream");
const { test } = require("node:test");
const { approvalGate } = require("../dist/gate");
const { createPrompt } = require("../dist/prompt");
const { generateInstrumentationSnippet } = require("../dist/snippet");
const { runPreflightChecks } = require("../dist/validator");

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "togglepilot-gate-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const appPath = join(directory, "app");
  mkdirSync(appPath);
  writeFileSync(join(appPath, "package.json"), JSON.stringify({ dependencies: { "@flagsmith/flagsmith": "^12.4.0" } }));
  const plan = {
    flagName: "headline_cta",
    variants: [
      { key: "short", label: "Short", value: "Shorter headline" },
      { key: "direct", label: "Direct", value: "Direct headline" },
    ],
    metric: { eventName: "cta_clicked", aggregation: "occurrence", direction: "higher" },
    rolloutPercent: 80,
    variationSplit: [20, 30, 50],
    hypothesis: { change: "Shorter headline", metric: "cta_clicked", expectedEffect: "increase 10%", timeframe: "30 days" },
    environment: "Production",
    appPath,
  };
  writeFileSync(join(directory, "plan.json"), JSON.stringify(plan));
  return { directory, plan };
}

const edits = (split) => ["e", "", "", "New headline", "", "", "", split, "60", "headline_clicked"].join("\n") + "\n";

async function review(plan, input) {
  const output = [];
  const preflight = {
    appPath: plan.appPath,
    apiKey: "test-api",
    environmentKey: "test-env",
    fetchImpl: async () => Response.json([{}]),
  };
  const report = await runPreflightChecks(plan, generateInstrumentationSnippet(plan), preflight);
  const prompt = createPrompt(Readable.from([input]));
  try {
    const outcome = await approvalGate({ plan, report }, {
      prompt, preflight, print: (message) => output.push(message),
      printPlan: (_, snippet) => output.push(snippet),
    });
    return { outcome, output: output.join("\n") };
  } finally {
    prompt.close();
  }
}

function editedPlan(plan) {
  const edited = structuredClone(plan);
  edited.variants[0].value = "New headline";
  edited.variationSplit = [35, 25, 40];
  edited.rolloutPercent = 60;
  edited.metric.eventName = edited.hypothesis.metric = "headline_clicked";
  return edited;
}

test("piped approval returns the unchanged plan", async (t) => {
  const { plan } = fixture(t);
  const { outcome } = await review(plan, "a\n");
  assert.equal(outcome.decision, "approved");
  assert.equal(outcome.plan, plan);
});

test("piped edits regenerate the snippet and return the approved plan", async (t) => {
  const { plan } = fixture(t);
  const { outcome, output } = await review(plan, edits("35,25,40") + "APPROVE\n");
  assert.equal(outcome.decision, "approved");
  assert.deepEqual(outcome.plan, editedPlan(plan));
  assert.equal(output.match(/^PASS —/gm)?.length, 5);
  assert.match(output, /trackEvent\("headline_clicked"\)/);
});

test("a split that does not total 100 blocks approval and repeats the choice", async (t) => {
  const { plan } = fixture(t);
  const { outcome, output } = await review(plan, edits("35,25,30") + "a\nr\n");
  assert.match(output, /totaling 100/);
  assert.match(output, /Approval is unavailable/);
  assert.equal(output.match(/\[A\]pprove/g)?.length, 3);
  assert.equal(outcome.decision, "rejected");
  assert.equal(outcome.plan, plan);
});

test("a failed pre-flight check on an edit blocks approval", async (t) => {
  const { plan } = fixture(t);
  writeFileSync(join(plan.appPath, "app.js"), 'flagsmith.trackEvent("cta_clicked");');
  const { outcome, output } = await review(plan, edits("35,25,40") + "a\nr\n");
  assert.match(output, /FAIL — Metric event name/);
  assert.match(output, /Approval is unavailable/);
  assert.equal(outcome.decision, "rejected");
});

function runCli(directory, input, warehouseReads, args = ["run", "--plan-file", "plan.json"], failure) {
  const cli = `
    const assert = require("node:assert/strict");
    const requests = [];
    global.fetch = async (url, request) => {
      requests.push([url, request.method]);
      return Response.json([{}]);
    };
    process.on("exit", () => assert.deepEqual(requests, Array(${warehouseReads}).fill([
      "https://flagsmith.example.invalid/api/v1/environments/test-env/warehouse-connections/", "GET"
    ])));
    require(${JSON.stringify(require.resolve("../dist/executor"))}).executePlan = async () => (${JSON.stringify(failure ?? null)}) ?? ({
      ok: true,
      calls: ["Verify experiment"],
      objects: {
        flag: { id: 1, action: "created", verified: true },
        metric: { id: 2, action: "reused", verified: true },
        experiment: { id: 3, action: "created", verified: true },
      },
    });
    process.argv.splice(1, 0, "mock-cli");
    require(${JSON.stringify(require.resolve("../dist/cli"))});
  `;
  const stdinPath = join(directory, "stdin");
  const stdoutPath = join(directory, "stdout");
  const stderrPath = join(directory, "stderr");
  writeFileSync(stdinPath, input);
  const stdio = [openSync(stdinPath, "r"), openSync(stdoutPath, "w"), openSync(stderrPath, "w")];
  try {
    const result = spawnSync(process.execPath, ["-e", cli, "--", ...args], {
      cwd: directory, stdio, timeout: 5000,
      env: {
        FLAGSMITH_API_URL: "https://flagsmith.example.invalid",
        FLAGSMITH_API_KEY: "test-api",
        FLAGSMITH_ENVIRONMENT_KEY: "test-env",
      },
    });
    const stdout = readFileSync(stdoutPath, "utf8");
    const stderr = readFileSync(stderrPath, "utf8");
    assert.ifError(result.error);
    assert.equal(result.status, failure ? 1 : 0, stderr);
    if (failure) assert.equal(stderr.trim(), `${failure.step}: ${failure.error}`);
    assert.doesNotMatch(stdout + stderr, /test-api|test-env/);
    return stdout;
  } finally {
    stdio.forEach((fd) => closeSync(fd));
  }
}

function readRecord(directory) {
  const runs = join(directory, "runs");
  const [slug, ...others] = readdirSync(runs);
  assert.match(slug, /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z$/);
  assert.deepEqual(others, []);
  const path = join(runs, slug);
  return {
    plan: JSON.parse(readFileSync(join(path, "plan.json"), "utf8")),
    record: readFileSync(join(path, "run-record.md"), "utf8"),
  };
}

test("CLI rejects with exit 0, no mutation, and a rejected run record", (t) => {
  const { directory, plan } = fixture(t);
  const output = runCli(directory, "r\n", 1);
  assert.match(output, /Rejected — nothing was created\./);
  const planStart = output.indexOf(JSON.stringify(plan, null, 2));
  assert.ok(planStart >= 0 && planStart < output.indexOf("[A]pprove"));
  assert.match(output, /Instrumentation snippet/);
  const saved = readRecord(directory);
  assert.deepEqual(saved.plan, plan);
  assert.match(saved.record, /Gate decision: rejected/);
  assert.match(saved.record, /Nothing was created\./);
});

test("CLI saves the approved edited plan and its pre-flight report", (t) => {
  const { directory, plan } = fixture(t);
  const output = runCli(directory, edits("35,25,40") + "a\n", 2);
  assert.match(output, /^Approved\.$/m);
  assert.match(output, /Experiment created \(not started\)\./);
  const saved = readRecord(directory);
  assert.deepEqual(saved.plan, editedPlan(plan));
  assert.match(saved.record, /Gate decision: approved/);
  assert.match(saved.record, /Metric: headline_clicked/);
  assert.match(saved.record, /experiment ID 3 \(created, verified\)/);
  assert.equal(saved.record.match(/^- PASS —/gm)?.length, 5);
  assert.match(saved.record, /Started at:.*\n- Decided at:/);
});

test("guided input and approval share one piped stream while plan-only skips review", (t) => {
  const { directory, plan } = fixture(t);
  const args = ["run", "Test whether a shorter headline lifts clicks", "--guided", "--app-path", plan.appPath];
  const input = "\n".repeat(18) + "a\n";
  const preview = runCli(directory, input, 0, [...args, "--plan-only"]);
  assert.doesNotMatch(preview, /\[A\]pprove/);
  assert.equal(existsSync(join(directory, "runs")), false);
  assert.match(runCli(directory, input, 1, args), /^Approved\.$/m);
});

test("CLI appends an execution failure and partial IDs to the approved record", (t) => {
  const { directory, plan } = fixture(t);
  const failure = {
    ok: false,
    step: "Create experiment",
    error: 'HTTP 409 {"detail":"An active experiment already exists for this feature."}',
    calls: ["Verify flag", "Create experiment"],
    objects: { flag: { id: 1, action: "created", verified: true } },
  };
  const output = runCli(directory, "a\n", 1, undefined, failure);
  assert.doesNotMatch(output, /Experiment created/);
  const saved = readRecord(directory);
  assert.deepEqual(saved.plan, plan);
  assert.match(saved.record, /flag ID 1 \(created, verified\)/);
  assert.ok(saved.record.includes(`Failed step: ${failure.step}\n- Error: ${failure.error}`));
});
