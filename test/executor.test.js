const assert = require("node:assert/strict");
const { test } = require("node:test");
const { executePlan } = require("../dist/executor");

const plan = {
  flagName: "togglepilot_headline_cta",
  variants: [{ key: "short", label: "Short", value: "Try it" }],
  metric: { eventName: "cta_clicked", direction: "higher", aggregation: "occurrence" },
  rolloutPercent: 80,
  variationSplit: [50, 50],
  hypothesis: { change: "Shorter CTA", metric: "cta_clicked", expectedEffect: "increase", timeframe: "30 days" },
  appPath: ".",
  environment: "Production",
};
const flag = {
  id: 11, name: plan.flagName,
  variants: [{ id: 21, key: "short", value: "Try it" }],
};
const metric = { id: 512, definition: { event: "cta_clicked" } };
const createdMetric = { id: 513, definition: { event: "cta_clicked" } };
const experimentPayload = (metricId) => ({
  feature: 11, name: "togglepilot_headline_cta_experiment",
  hypothesis: "Shorter CTA will cause cta_clicked to increase within 30 days.",
  metrics: [{ metric: metricId, expected_direction: "increase" }],
  experiment_rollout: {
    enabled: true, rollout_percentage: 80, feature_state_value: { type: "string", value: "control" },
    multivariate_feature_state_values: [{ multivariate_feature_option: 21, percentage_allocation: 50 }],
  },
});
const conflict = '{"detail":"An active experiment already exists for this feature."}';

async function run({ flagRead = flag, reuseFlag = false, reuseMetric = true, failCreate = false,
  mismatch = false, cliFailure = false, variantStdout = '{"id":21}', executionPlan = plan,
  experimentFeature = flag.id } = {}) {
  const commands = [];
  const requests = [];
  const metricId = reuseMetric ? metric.id : createdMetric.id;
  let currentFlag = reuseFlag ? flagRead : { ...flag, variants: [] };
  const result = await executePlan(executionPlan, {
    projectId: 55638, appPath: ".", apiKey: "test-api", environmentKey: "test-env",
    spawnImpl(command, args, options) {
      assert.match(command, /flagsmith$/);
      assert.equal(options.env.FLAGSMITH_API_KEY, "test-api");
      assert.equal(options.cwd, ".");
      assert.deepEqual(args.slice(-6, -4), ["--project", "55638"]);
      const action = args.slice(1, -6);
      commands.push(action);
      if (cliFailure) return { status: 1, stderr: "permission denied\n", stdout: "" };
      if (action[0] === "variant") {
        currentFlag = { ...currentFlag, variants: flag.variants };
        return { status: 0, stderr: "", stdout: variantStdout };
      }
      const response = {
        list: reuseFlag ? [flag] : [],
        create: { id: flag.id },
        get: currentFlag,
      }[action[0]];
      return { status: 0, stderr: "", stdout: JSON.stringify(response) };
    },
    async fetchImpl(url, options) {
      assert.equal(options.headers.Authorization, "Api-Key test-api");
      const path = new URL(url).pathname.replace("/api/v1/environments/test-env/", "");
      requests.push(`${options.method} ${path}`);
      switch (requests.at(-1)) {
        case "GET experiment-metrics/":
          return Response.json(reuseMetric ? [metric] : [{ definition: { event: "CTA_clicked" } }]);
        case "POST experiment-metrics/":
          assert.deepEqual(JSON.parse(options.body), {
            name: "cta_clicked", aggregation: "occurrence", direction: "up", definition: { version: 1, event: "cta_clicked" },
          });
          return Response.json({ id: createdMetric.id }, { status: 201 });
        case "GET experiment-metrics/513/":
          return Response.json(createdMetric);
        case "POST experiments/":
          assert.deepEqual(JSON.parse(options.body), experimentPayload(metricId));
          return failCreate ? new Response(conflict, { status: 409 }) : Response.json({ id: 31 }, { status: 201 });
        case "GET experiments/31/": {
          const payload = experimentPayload(metricId);
          if (mismatch) payload.experiment_rollout.rollout_percentage = 70;
          return Response.json({ id: 31, status: "CREATED", ...payload, feature: experimentFeature });
        }
        default:
          assert.fail(`Unexpected request ${path}`);
      }
    },
  });
  return { result, commands, requests };
}

const list = ["list", "--include-archived"];
const get = ["get", "11"];
const add = ["variant", "add", "11", "--key", "short", "--value=Try it", "--type", "string", "--weight", "50"];
const created = (id, verified = true) => ({ id, action: "created", verified });
const reused = (id) => ({ id, action: "reused", verified: true });
const experimentCalls = ["POST experiments/", "GET experiments/31/"];

test("creates a fresh flag and keyed variant, reuses a metric, and verifies the experiment", async () => {
  const { result, commands, requests } = await run();
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.objects, {
    flag: created(11), metric: reused(512), experiment: created(31),
  });
  assert.deepEqual(commands, [list, ["create", plan.flagName, "--value", "control", "--enabled"],
    get, add, get]);
  assert.deepEqual(requests, ["GET experiment-metrics/", ...experimentCalls]);
});

test("verifies an experiment when the GET returns an expanded feature", async () => {
  const { result } = await run({
    experimentFeature: { id: flag.id, name: flag.name, type: "MULTIVARIATE" },
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.objects.experiment, created(31));
});

test("completes when variant creation returns empty stdout", async () => {
  const { result } = await run({ variantStdout: "" });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.objects.experiment, created(31));
});

test("adds a missing variant to an existing flag and verifies it", async () => {
  const { result, commands } = await run({
    reuseFlag: true, flagRead: { ...flag, variants: [] }, variantStdout: " \n",
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.objects.flag, reused(11));
  assert.deepEqual(commands, [list, get, add, get]);
});

test("creates and verifies a metric if the exact event name is absent", async () => {
  const { result, requests } = await run({ reuseMetric: false });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.objects.metric, created(513));
  assert.deepEqual(requests, ["GET experiment-metrics/", "POST experiment-metrics/",
    "GET experiment-metrics/513/", ...experimentCalls]);
});

test("reuses a flag with matching variants", async () => {
  const { result, commands } = await run({ reuseFlag: true });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.objects.flag, reused(11));
  assert.deepEqual(commands, [list, get, get]);
});

test("a conflicting flag fails before any writes", async () => {
  const { result, requests, commands } = await run({
    reuseFlag: true, flagRead: { ...flag, variants: [{ id: 21, key: "short", value: "Different" }] },
    executionPlan: {
      ...plan, variants: [{ key: "other", label: "Other", value: "Other CTA" }, ...plan.variants],
      variationSplit: [25, 50, 25],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.step, "Verify flag");
  assert.match(result.error, /Expected .*Try it.*, got .*Different/);
  assert.deepEqual(commands, [list, get]);
  assert.deepEqual(requests, []);
});

test("surfaces an exact 409 without retrying or claiming creation", async () => {
  const { result, requests } = await run({ reuseFlag: true, failCreate: true });
  assert.equal(result.ok, false);
  assert.equal(result.step, "Create experiment");
  assert.equal(result.error, `HTTP 409 ${conflict}`);
  assert.deepEqual(result.objects, { flag: reused(11), metric: reused(512) });
  assert.deepEqual(requests, ["GET experiment-metrics/", "POST experiments/"]);
});

test("a verification mismatch preserves the ID and fails the execution", async () => {
  const { result } = await run({ mismatch: true });
  assert.equal(result.ok, false);
  assert.equal(result.step, "Verify experiment");
  assert.match(result.error, /Expected .*"rollout_percentage":80.*, got .*"rollout_percentage":70/);
  assert.deepEqual(result.objects.experiment, created(31, false));
});

test("reports the CLI error and skips subsequent steps", async () => {
  const { result, requests, commands } = await run({ cliFailure: true });
  assert.deepEqual(result, { ok: false, step: "List flags", error: "permission denied", calls: ["List flags"], objects: {} });
  assert.deepEqual(requests, []);
  assert.deepEqual(commands, [list]);
});
