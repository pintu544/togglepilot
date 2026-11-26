const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { isExperimentPlan } = require("../dist/planner");
const { generateInstrumentationSnippet } = require("../dist/snippet");

const snippetHeader = "\n--- Instrumentation snippet (paste into the host app) ---\n";

const samples = [
  ["Test whether a shorter headline lifts clicks on my landing page", "cta_clicked"],
  ["Test whether a green signup button converts better than the blue one on the pricing page", "signup_completed"],
  ["Test whether showing customer logos on the homepage increases demo bookings", "demo_booked"],
];

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
  appPath: "./landing",
};

test("valid plan passes local validation", () => {
  assert.equal(isExperimentPlan(plan), true);
});

test("one variant with a 50/50 split passes local validation", () => {
  assert.equal(isExperimentPlan({ ...plan, variants: plan.variants.slice(0, 1), variationSplit: [50, 50] }), true);
});

test("a control-only plan fails local validation", () => {
  assert.equal(isExperimentPlan({ ...plan, variants: [], variationSplit: [100] }), false);
});

const invalidCases = {
  "missing variant key": (draft) => delete draft.variants[0].key,
  "duplicate variant key": (draft) => draft.variants[1].key = draft.variants[0].key,
  "reserved control key": (draft) => draft.variants[0].key = "control",
  "split does not sum to 100": (draft) => draft.variationSplit[0] = 10,
  "bad aggregation": (draft) => draft.metric.aggregation = "median",
  "incomplete hypothesis": (draft) => delete draft.hypothesis.timeframe,
};

for (const [name, invalidate] of Object.entries(invalidCases)) {
  test(`rejects ${name}`, () => {
    const draft = structuredClone(plan);
    invalidate(draft);
    assert.equal(isExperimentPlan(draft), false);
  });
}

const env = { ...process.env };
for (const name of [
  "FLAGSMITH_API_KEY", "FLAGSMITH_ENVIRONMENT_KEY",
  "TOGGLEPILOT_LLM_API_KEY", "TOGGLEPILOT_LLM_BASE_URL", "TOGGLEPILOT_LLM_MODEL",
]) delete env[name];

function run(options, input, command = ["dist/cli.js"], overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "togglepilot-test-"));
  const stdin = join(directory, "answers");
  const stdout = join(directory, "stdout");
  const stderr = join(directory, "stderr");
  writeFileSync(stdin, input);
  const output = openSync(stdout, "w");
  const errors = openSync(stderr, "w");
  try {
    // Use a shell pipe so the CLI reads piped lines in restricted test environments too.
    const result = spawnSync("sh", ["-c", 'answers="$1"; shift; cat "$answers" | "$@"', "togglepilot-test", stdin,
      process.execPath, ...command, "run", ...options], {
      stdio: ["ignore", output, errors], env: { ...env, ...overrides }, timeout: 5000,
    });
    if (result.error) throw result.error;
    return { ...result, stdout: readFileSync(stdout, "utf8"), stderr: readFileSync(stderr, "utf8") };
  } finally {
    closeSync(output);
    closeSync(errors);
    rmSync(directory, { recursive: true, force: true });
  }
}

function readPlan(result) {
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const [output, snippet] = result.stdout.split(snippetHeader);
  const plan = JSON.parse(output.slice(output.indexOf("\n{") + 1));
  assert.equal(snippet, generateInstrumentationSnippet(plan) + "\n");
  return plan;
}

for (const [sentence, eventName] of samples) {
  test(`fallback produces a complete plan for ${eventName}`, () => {
    const result = run([sentence, "--plan-only"], "\n".repeat(19));
    assert.match(result.stdout, /Guided planning/);
    const draft = readPlan(result);
    assert.equal(isExperimentPlan(draft), true);
    assert.equal(draft.variants.length, 1);
    assert.deepEqual(draft.variationSplit, [50, 50]);
    assert.equal(draft.metric.eventName, eventName);
  });
}

test("LLM and piped guided plans match for the same inputs, and invalid drafts fall back", () => {
  const args = [samples[0][0], "--plan-only", "--app-path", "./landing", "--flag", "headline_cta", "--metric-event", "cta_clicked"];
  const answers = [
    "Production", "2", "short", "Short", "Shorter headline", "direct", "Direct", "Direct headline",
    "occurrence", "higher", "80", "20,30", "Shorter headline", "cta_clicked", "increase 10%", "30 days",
  ].join("\n") + "\n";
  const llmEnv = {
    TOGGLEPILOT_LLM_API_KEY: "test-llm-secret",
    TOGGLEPILOT_LLM_BASE_URL: "https://llm.example.invalid/v1/",
    TOGGLEPILOT_LLM_MODEL: "test-model",
  };
  function withContent(content) {
    return ["-e", `
      const assert = require("node:assert/strict");
      global.fetch = async (url, request) => {
        assert.equal(url, "https://llm.example.invalid/v1/chat/completions");
        assert.equal(request.headers.Authorization, "Bearer test-llm-secret");
        const body = JSON.parse(request.body);
        assert.equal(body.model, "test-model");
        assert.equal(body.response_format.json_schema.strict, true);
        return Response.json({ choices: [{ message: { content: ${JSON.stringify(content)} } }] });
      };
      process.argv.splice(1, 0, "mock-cli");
      require("./dist/cli");
    `, "--"];
  }

  const json = JSON.stringify(plan);
  const llm = run(args, "", withContent(json), llmEnv);
  assert.doesNotMatch(llm.stdout, /Guided planning|test-llm-secret/);
  assert.deepEqual(readPlan(llm), plan);
  assert.deepEqual(readPlan(run([...args, "--guided"], answers, withContent(json), llmEnv)), plan);

  for (const content of [" \n```json\n" + json + "\n```\n ", "```\n" + json + "\n```", `Draft follows:\n${json}\nEnd of draft.`]) {
    const result = run(args, "", withContent(content), llmEnv);
    assert.doesNotMatch(result.stdout, /Guided planning/);
    const draft = readPlan(result);
    assert.equal(isExperimentPlan(draft), true);
    assert.deepEqual(draft, plan);
  }

  const invalid = structuredClone(plan);
  delete invalid.hypothesis.timeframe;
  for (const content of [JSON.stringify(invalid), "Draft follows: { malformed JSON }"]) {
    const fallback = run(args, answers, withContent(content), llmEnv);
    assert.match(fallback.stdout, /Guided planning/);
    assert.deepEqual(readPlan(fallback), plan);
  }
});

test("run without --plan-only still requires Flagsmith credentials", () => {
  const result = run([samples[0][0]], "");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing required credentials/);
});

test("instrumentation uses the plan's exact flag, variants and metric and compiles as TSX", (t) => {
  const draft = structuredClone(plan);
  draft.metric.eventName = 'CTA_"Clicked"';
  draft.variants[0].value = 'Shorter "headline"\nTry it';
  const snippet = generateInstrumentationSnippet(draft);
  assert.match(snippet, /enableEvents: true/);
  assert.match(snippet, /import\.meta\.env\.VITE_FLAGSMITH_ENVIRONMENT_ID/);
  assert.ok(snippet.includes('getExperimentFlag("headline_cta")'));
  assert.ok(snippet.includes("trackEvent(" + JSON.stringify(draft.metric.eventName) + ")"));
  for (const { value } of draft.variants) {
    assert.ok(snippet.includes(JSON.stringify(value)));
  }

  // Keep the temporary TSX under the repo so TypeScript resolves its real SDK and React types.
  const directory = mkdtempSync(join(__dirname, "snippet-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const tsx = join(directory, "ExperimentCTA.tsx");
  const viteTypes = join(directory, "vite.d.ts");
  writeFileSync(tsx, snippet);
  writeFileSync(viteTypes, "interface ImportMeta { readonly env: { readonly VITE_FLAGSMITH_ENVIRONMENT_ID: string } }\n");
  const result = spawnSync(process.execPath, [
    require.resolve("typescript/bin/tsc"), "--noEmit", "--strict", "--target", "ES2022",
    "--module", "ESNext", "--moduleResolution", "bundler", "--jsx", "react-jsx",
    tsx, viteTypes,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
});

test("instrumentation satisfies preflight check #5 with identity and flush calls", () => {
  const snippet = generateInstrumentationSnippet(plan);
  assert.match(snippet, /\bidentify\(persistentIdentity\(\)\)/);
  assert.match(snippet, /\bflushEvents\(\)/);
});

test("instrumentation excludes Flagsmith credentials from the environment", () => {
  const names = ["FLAGSMITH_API_KEY", "FLAGSMITH_ENVIRONMENT_KEY", "VITE_FLAGSMITH_ENVIRONMENT_ID"];
  for (const name of names) {
    const original = process.env[name];
    try {
      const sample = "test-credential-" + name;
      process.env[name] = sample;
      const snippet = generateInstrumentationSnippet(plan);
      assert.equal(snippet.includes(sample), false);
      if (original) assert.equal(snippet.includes(original), false);
    } finally {
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  }
});
