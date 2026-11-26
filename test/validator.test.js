const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { generateInstrumentationSnippet } = require("../dist/snippet");
const { runPreflightChecks, formatPreflightReport } = require("../dist/validator");

const sampleApp = join(__dirname, "fixtures", "sample-app");
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
  appPath: sampleApp,
};

const pendingWarehouse = () => Response.json([{ status: "pending_connection" }]);
const snippet = generateInstrumentationSnippet(plan);

function validate({ draft = plan, instrumentation = snippet, appPath = sampleApp, fetchImpl = pendingWarehouse } = {}) {
  return runPreflightChecks(draft, instrumentation, {
    appPath, fetchImpl, environmentKey: "test-env", apiKey: "test-api",
  });
}

function temporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), "togglepilot-preflight-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("all five checks pass, including a pending warehouse connection", async () => {
  const report = await validate();
  assert.deepEqual(report.map(({ status }) => status), Array(5).fill("pass"));
  const output = formatPreflightReport(report);
  assert.equal(output.split("\n").length, 5);
  assert.match(output, /^PASS — Warehouse connection\. The environment has a warehouse connection\. No fix needed\./);
});

for (const [name, fetchImpl, detail] of [
  ["empty warehouse list", () => Response.json([]), /no warehouse connections/],
  ["non-200 warehouse response", () => new Response(null, { status: 401 }), /HTTP 401/],
  ["warehouse network error", () => { throw new Error("Sensitive URL"); }, /Could not read/],
]) {
  test(name, async () => {
    const [warehouse] = await validate({ fetchImpl });
    assert.equal(warehouse.status, "fail");
    assert.match(warehouse.detail, detail);
    assert.match(warehouse.fix, /Connect the managed warehouse/);
  });
}

test("an unlabelled variant fails with the index and a fix", async () => {
  const draft = structuredClone(plan);
  delete draft.variants[0].label;
  const report = await validate({ draft });
  assert.deepEqual(report.map(({ status }) => status), ["pass", "fail", "pass", "pass", "pass"]);
  assert.match(formatPreflightReport(report),
    /FAIL — Variant keys and labels\. Variant 1 is missing its label\. Give every variant a unique key, a label and a value\./);
});

test("duplicate and reserved keys and empty values are flagged", async () => {
  const draft = structuredClone(plan);
  draft.variants[0].key = draft.variants[1].key = "control";
  draft.variants[1].value = "";
  const [, variants] = await validate({ draft });
  assert.equal(variants.status, "fail");
  assert.match(variants.detail, /Variant 1 uses the reserved control key/);
  assert.match(variants.detail, /Variant 2 repeats a variant key/);
  assert.match(variants.detail, /Variant 2 is missing its value/);
});

test("a case-only event mismatch reports the app's exact event name", async () => {
  const draft = structuredClone(plan);
  draft.metric.eventName = "CTA_Clicked";
  const [, , event] = await validate({ draft, instrumentation: generateInstrumentationSnippet(draft) });
  assert.equal(event.status, "fail");
  assert.match(event.fix, /Expected "cta_clicked"/);
});

test("apps with no trackEvent calls use the snippet, and interpolations do not count as literals", async (t) => {
  const appPath = temporaryDirectory(t);
  const source = join(appPath, "CTA.jsx");
  writeFileSync(source, "// trackEvent('other_event')\n");
  let [, , event] = await validate({ appPath });
  assert.equal(event.status, "pass");
  assert.match(event.detail, /generated snippet/);

  writeFileSync(source, "flagsmith.trackEvent(`cta_${suffix}`);\n");
  [, , event] = await validate({ appPath });
  assert.equal(event.status, "fail");
  assert.match(event.fix, /literal trackEvent call/);
});

test("a missing app path fails the event and SDK checks", async () => {
  const [, , event, sdk] = await validate({ appPath: join(sampleApp, "missing") });
  assert.equal(event.status, "fail");
  assert.match(event.fix, /Point --app-path at the app/);
  assert.equal(sdk.status, "fail");
  assert.match(sdk.fix, /valid package.json/);
});

for (const [name, manifest, detail, fix] of [
  ["browser SDK below minimum", { dependencies: { "@flagsmith/flagsmith": "~12.3.9" } }, /12\.3\.9.*12\.4\.0/, /Set @flagsmith\/flagsmith/],
  ["browser SDK missing", {}, /@flagsmith\/flagsmith is missing/, /Install @flagsmith\/flagsmith/],
  ["Node SDK below minimum in devDependencies", {
    dependencies: { "@flagsmith/flagsmith": ">=12.4.0" }, devDependencies: { "@flagsmith/nodejs": "^9.0.9" },
  }, /9\.0\.9.*9\.1\.0/, /Set @flagsmith\/nodejs/],
]) {
  test(name, async (t) => {
    const appPath = temporaryDirectory(t);
    writeFileSync(join(appPath, "package.json"), JSON.stringify(manifest));
    const [, , , sdk] = await validate({ appPath });
    assert.equal(sdk.status, "fail");
    assert.match(sdk.detail, detail);
    assert.match(sdk.fix, fix);
  });
}

for (const missing of ["identify", "flushEvents"]) {
  test(`instrumentation missing ${missing} fails`, async () => {
    const report = await validate({ instrumentation: snippet.replace(`flagsmith.${missing}(`, "replacement(") });
    const check = report[4];
    assert.equal(check.status, "fail");
    assert.ok(check.detail.includes(`missing ${missing}()`));
    assert.ok(check.fix.includes(`${missing}()`));
  });
}

test("CLI runs all checks on a broken plan file without creating any Flagsmith objects", (t) => {
  const directory = temporaryDirectory(t);
  const planFile = join(directory, "plan.json");
  const draft = structuredClone(plan);
  draft.appPath = "missing";
  delete draft.variants[0].label;
  writeFileSync(planFile, JSON.stringify(draft));

  const cli = `
    const assert = require("node:assert/strict");
    const requests = [];
    global.fetch = async (url, request) => {
      requests.push({ url, method: request.method, auth: request.headers.Authorization });
      return Response.json([{ status: "pending_connection" }]);
    };
    process.on("exit", () => {
      assert.deepEqual(requests, [{
        url: "https://flagsmith.example.invalid/api/v1/environments/test-env/warehouse-connections/",
        method: "GET",
        auth: "Api-Key test-api",
      }]);
    });
    process.argv.splice(1, 0, "mock-cli");
    require("./dist/cli");
  `;
  const env = {
    ...process.env, FLAGSMITH_API_URL: "https://flagsmith.example.invalid/",
    FLAGSMITH_API_KEY: "test-api", FLAGSMITH_ENVIRONMENT_KEY: "test-env",
  };
  const args = ["run", "--plan-file", planFile, "--app-path", sampleApp];
  function run(code, ...options) {
    const stdout = join(directory, "stdout");
    const stderr = join(directory, "stderr");
    const output = openSync(stdout, "w");
    const errors = openSync(stderr, "w");
    try {
      const result = spawnSync(process.execPath, ["-e", code, "--", ...options], {
        stdio: ["ignore", output, errors], env, timeout: 5000,
      });
      assert.ifError(result.error);
      return { ...result, stdout: readFileSync(stdout, "utf8"), stderr: readFileSync(stderr, "utf8") };
    } finally {
      closeSync(output);
      closeSync(errors);
    }
  }
  const failed = run(cli, ...args);
  assert.equal(failed.status, 1, failed.stderr);
  assert.doesNotMatch(failed.stderr, /AssertionError/);
  assert.equal(failed.stdout.match(/^PASS —/gm)?.length, 4);
  assert.match(failed.stdout, /^FAIL — Variant keys and labels.*Variant 1 is missing its label.*Give every variant/m);
  assert.match(failed.stderr, /Pre-flight failed — nothing was created\./);
  assert.doesNotMatch(failed.stdout + failed.stderr, /test-api|test-env/);

  writeFileSync(planFile, "{ malformed");
  const noFetch = `
    global.fetch = async () => { process.exit(99); };
    process.argv.splice(1, 0, "mock-cli");
    require("./dist/cli");
  `;
  const invalid = run(noFetch, ...args);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /plan file is not valid JSON/);
  const conflicting = run(noFetch, ...args, "Test a shorter headline");
  assert.equal(conflicting.status, 1);
  assert.match(conflicting.stderr, /Use either --plan-file or an experiment sentence/);
});
