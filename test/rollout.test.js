const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { join } = require('node:path');
const test = require('node:test');
const { rollout } = require('../dist/rollout');

const option = { id: 37116, key: 'Variant_1', string_value: 'shorter_headline' };
const experiment = {
  id: 590, status: 'running', started_at: '2026-11-27',
  feature: { id: 305212, multivariate_options: [option] },
  metrics: [{ metric: 512, metric_name: 'cta_clicked', aggregation: 'occurrence' }],
};
const complete = '/experiments/590/complete/';
const flag = '/features/305212/';
const detail = '/experiments/590/';
const arm = { n: 200, sum: 60 };

async function scenario(t, config = {}) {
  const { probability = 0.951, srm = null, dryRun = false, answer = 'approve',
    preStart = false, updateFails = false, flagWrong = false, endWrong = false,
    secondWinner = false, controlWins = false, inferenceWithheld = false } = config;
  const dir = await mkdtemp(join('runs', 'rollout-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const output = [];
  const variants = { control: arm, Variant_1: { n: 200, sum: 84 } };
  const stats = { chance_to_win: probability, lift: 0.4, ci_low: 0.1, ci_high: 0.7 };
  const inference = { Variant_1: inferenceWithheld ? null : stats };
  if (secondWinner) {
    variants.Variant_2 = arm;
    inference.Variant_2 = stats;
  }
  if (controlWins) {
    inference.control = stats;
    inference.Variant_1 = { ...stats, chance_to_win: 0.01 };
  }
  const result = preStart ? null : { payload: { srm_p_value: srm, metrics: [{ metric_id: 512, variants, inference }] } };
  let completed = false;
  const decision = controlWins ? { rollout_decision: 'control' } : { rollout_decision: 'variant', rollout_variant: option.id };
  const execute = () => rollout({
    experimentId: 590, environmentKey: 'environment', apiKey: 'key', redact: String,
    dryRun, cachePath: join(dir, 'cache.json'), print: (line) => output.push(line),
    prompt: { read: async () => { calls.push('prompt'); return answer; }, close() {} },
    fetchImpl: async (url, init) => {
      const path = new URL(url).pathname.replace(/^\/api\/[^/]+\/environments\/environment/, '');
      calls.push(`${init.method} ${path}`);
      if (init.method === 'POST') {
        assert.equal(path, complete);
        assert.deepEqual(JSON.parse(init.body), decision);
        if (updateFails) return new Response('flag is locked', { status: 409 });
        completed = true;
        return new Response(null, { status: 204 });
      }
      assert.equal(init.method, 'GET');
      if (path === flag) return Response.json({
        environment_default: { enabled: true, value: { type: 'string', value: 'control' },
          variants: [{ id: option.id, weight: flagWrong || controlWins ? 0 : 100 }] },
        segment_overrides: [],
      });
      if (path.endsWith('/results/')) return Response.json({ results: result });
      if (path.endsWith('/exposures/')) return Response.json({ exposures: null });
      assert.equal(path, detail);
      if (preStart) return Response.json({ ...experiment, status: 'created', started_at: null });
      if (completed && !endWrong) return Response.json({
        ...experiment, ...decision, rollout_variant: decision.rollout_variant ?? null,
        status: 'completed', ended_at: '2026-11-28',
      });
      return Response.json(experiment);
    },
  });
  return { execute, calls, output };
}

const initialReads = [`GET ${detail}`, `GET ${detail}results/`, `GET ${detail}exposures/`];

for (const [title, config, message] of [
  ['pre-start null results', { preStart: true }, /Collecting data[\s\S]*Keep running/],
  ['withheld inference', { inferenceWithheld: true }, /Collecting data[\s\S]*Keep running/],
  ['inconclusive results', { probability: 0.70 }, /70%[\s\S]*Keep running/],
  ['exactly 95 percent', { probability: 0.95 }, /95%[\s\S]*Keep running/],
  ['two qualifying arms', { secondWinner: true }, /Keep running/],
  ['SRM', { srm: 0.0001 }, /Don't act on the results/],
  ['dry run at 95.1 percent', { dryRun: true }, /95\.1% win probability[\s\S]*shorter_headline[\s\S]*complete\//],
]) {
  test(`${title} makes no mutations and never prompts`, async (t) => {
    const { execute, calls, output } = await scenario(t, config);
    await execute();
    assert.match(output.join('\n'), message);
    assert.deepEqual(calls, initialReads);
  });
}

for (const controlWins of [false, true]) {
  test(`approval applies the ${controlWins ? 'control' : 'variant'} and completes, then re-reads both resources`, async (t) => {
    const { execute, calls, output } = await scenario(t, { controlWins });
    await execute();
    assert.deepEqual(calls, [...initialReads, 'prompt', `POST ${complete}`, `GET ${flag}`, `GET ${detail}`]);
    assert.match(output.at(-1), /Verified flag 305212 .* experiment 590 ended/);
  });
}

test('rejection makes no mutations', async (t) => {
  const { execute, calls, output } = await scenario(t, { answer: 'reject' });
  await execute();
  assert.deepEqual(calls, [...initialReads, 'prompt']);
  assert.match(output.at(-1), /Rejected/);
});

for (const [config, error, reads] of [
  [{ updateFails: true }, /Update flag and end experiment: .*HTTP 409 flag is locked/, []],
  [{ flagWrong: true }, /Verify flag update:/, [`GET ${flag}`]],
  [{ endWrong: true }, /Verify experiment ended:/, [`GET ${flag}`, `GET ${detail}`]],
]) {
  test(`stops on ${Object.keys(config)[0]} without reporting success`, async (t) => {
    const { execute, calls, output } = await scenario(t, config);
    await assert.rejects(execute, error);
    assert.deepEqual(calls, [...initialReads, 'prompt', `POST ${complete}`, ...reads]);
    assert.doesNotMatch(output.join('\n'), /Verified flag/);
  });
}
