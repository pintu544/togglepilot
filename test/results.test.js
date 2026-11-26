const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { mkdir, rm } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const { estimateOccurrence, renderResults, readResults } = require('../dist/results');

const disclosure = readFileSync(path.join(__dirname, '../docs/seeded-cohort-disclosure.md'), 'utf8').trim();
const epoch = Date.parse('2026-11-26T12:00:00Z');
const experiment = {
  status: 'created',
  started_at: null,
  feature: { multivariate_options: [{ id: 10, key: 'Variant_1' }] },
  metrics: [{ metric: 512, metric_name: 'cta_clicked', aggregation: 'occurrence' }],
  experiment_rollout: {
    multivariate_feature_state_values: [{ multivariate_feature_option: 10, percentage_allocation: 50 }],
  },
};
const control = { n: 200, sum: 60 };
const treatment = { n: 200, sum: 84 };
const inference = { lift: 0.4, ci_low: 0.08, ci_high: 0.76, chance_to_win: 0.992 };

function fixture({ variant = treatment, reported = inference, srm = null } = {}) {
  return {
    as_of: '2026-11-26T11:59:00Z',
    payload: {
      srm_p_value: srm,
      metrics: [{
        metric_id: 512,
        variants: { control, Variant_1: variant },
        inference: { Variant_1: reported },
      }],
    },
  };
}

function render(results, exposures = null) {
  return renderResults(590, { fetched_at: epoch, response: { experiment, results, exposures } }, disclosure, 'Cache notice.');
}

test('Beta posterior normal approximation identifies a clear winner', () => {
  const stats = estimateOccurrence(control, treatment);
  assert.ok(stats.chance_to_win > 0.99 && stats.chance_to_win < 0.995);
  assert.ok(stats.lift > 0.39 && stats.lift < 0.4);
  assert.ok(stats.ci_low > 0 && stats.ci_high > stats.lift);
});

test('tied arms have approximately 50% probability', () => {
  assert.ok(Math.abs(estimateOccurrence(control, control).chance_to_win - 0.5) < 1e-6);
});

test('the prior regularizes one-sided small samples', () => {
  const stats = estimateOccurrence({ n: 3, sum: 0 }, { n: 1, sum: 1 });
  assert.ok(stats.chance_to_win > 0.5 && stats.chance_to_win < 0.95);
  assert.ok(stats.ci_low < 0 && Number.isFinite(stats.ci_high));
  assert.ok(estimateOccurrence(control, treatment, 'down').chance_to_win < 0.05);
});

test('null results show evidence and unavailable counts alongside the verbatim disclosure', () => {
  const output = render(null);
  assert.match(output, /Collecting data\. Flagsmith returned \{"results":null\}/);
  assert.match(output, /As of 2026-11-26T12:00:00\.000Z \(API read time/);
  assert.match(output, /unavailable identities enrolled, unavailable conversions/);
  assert.equal(output.split('\n').at(-1), disclosure);
});

test('exposure counts are shown even without computed results', () => {
  const output = render(null, { payload: { timeseries: { points: [
    { new_identities: { control: 15, Variant_1: 11 } },
    { new_identities: { control: 5, Variant_1: 3 } },
  ] } } });
  assert.match(output, /control: 20 identities enrolled, unavailable conversions/);
  assert.match(output, /Variant_1 needs 36 more identities/);
});

test('floors gate inference and show how much data is missing', () => {
  const output = render(fixture({ variant: { n: 46, sum: 2 } }));
  assert.match(output, /Variant_1: 46 identities enrolled, 2 conversions/);
  assert.match(output, /Collecting data.*Variant_1 needs 4 more identities, Variant_1 needs 3 more conversions/);
  assert.doesNotMatch(output, /Chance to beat control/);
});

test('explicitly withheld inference stays in Collecting data even when counts clear floors', () => {
  assert.match(render(fixture({ reported: null })), /Collecting data\. Flagsmith inference is unavailable/);
});

test('SRM shows observed and configured splits and suppresses recommendations', () => {
  const output = render(fixture({ variant: { n: 100, sum: 60 }, srm: 0.0001 }));
  assert.match(output, /Sample Ratio Mismatch \(SRM\)\. Don't act on the results/);
  assert.match(output, /Observed split: control 66\.67%, Variant_1 33\.33%/);
  assert.match(output, /Configured split: Variant_1 50%, control 50%/);
  assert.doesNotMatch(output, /Roll out the winner/);
});

test('a winning arm shows Flagsmith statistics and the results timestamp', () => {
  const output = render(fixture());
  assert.match(output, /As of 2026-11-26T11:59:00Z/);
  assert.match(output, /\(Flagsmith\): Lift vs control 40%, 95% credible interval 8% to 76%, Chance to beat control 99\.2%/);
  assert.match(output, /Winning\. Roll out the winner/);
});

test('the threshold boundaries are inconclusive and a probability below 5% is losing', () => {
  for (const chance_to_win of [0.05, 0.5, 0.95]) {
    assert.match(render(fixture({ reported: { ...inference, chance_to_win } })), /Inconclusive\. Keep running/);
  }
  assert.match(render(fixture({ reported: { ...inference, chance_to_win: 0.049 } })), /Losing\. Stop this variation/);
});

test('counts-only occurrence results label the fallback as a TogglePilot estimate', () => {
  const results = fixture();
  delete results.payload.metrics[0].inference;
  assert.match(render(results), /\(TogglePilot Bayesian estimate\).*Winning/s);
});

let cacheNumber = 0;
async function reader(t, metadata = experiment) {
  const directory = path.join('runs', `.results-test-${process.pid}-${cacheNumber++}`);
  await mkdir(directory, { recursive: true });
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = epoch;
  const calls = [];
  const read = (refresh = false, other = {}) => readResults({
    experimentId: 590, apiKey: 'test-api-key', environmentKey: 'test-environment', refresh,
    disclosure, redact: (message) => message.replaceAll('test-api-key', '[redacted]'),
    cachePath: path.join(directory, '.results-cache.json'), now: () => now,
    async fetchImpl(url, request) {
      const suffix = url.split(/\/experiments\/\d+\//)[1];
      calls.push([request.method, suffix]);
      assert.equal(request.headers.Authorization, 'Api-Key test-api-key');
      if (suffix === 'results/refresh/') return new Response(null, { status: 202 });
      return Response.json(suffix === 'results/' ? { results: null }
        : suffix === 'exposures/' ? { exposures: null } : metadata);
    },
    ...other,
  });
  return { read, calls, advance: (ms) => { now += ms; } };
}

test('the on-disk cache serves a recent GET and refuses forced refresh until the TTL expires', async (t) => {
  const { read, calls, advance } = await reader(t);
  assert.match(await read(), /Fetched from Flagsmith/);
  advance(299_999);
  const cached = await read();
  assert.match(cached, /As of 2026-11-26T12:00:00\.000Z/);
  assert.match(cached, /Showing cached response\. Fresh read available at 2026-11-26T12:05:00\.000Z/);
  assert.match(await read(true), /Refresh refused.*2026-11-26T12:05:00\.000Z/);
  assert.equal(calls.length, 3);
  advance(1);
  assert.match(await read(true), /Fetched from Flagsmith.*computation is available after start/);
  assert.equal(calls.length, 6);
  assert.ok(calls.every(([method]) => method === 'GET'));
});

test('an eligible forced refresh queues computation once for a started experiment', async (t) => {
  const { read, calls } = await reader(t, { ...experiment, status: 'running', started_at: new Date(epoch).toISOString() });
  assert.match(await read(true), /accepted the computation request/);
  assert.match(await read(true), /Refresh refused/);
  assert.deepEqual(calls.filter(([method]) => method === 'POST'), [['POST', 'results/refresh/']]);
});

test('API errors include the failed step and redact the credential', async (t) => {
  const { read } = await reader(t);
  await assert.rejects(read(false, {
    async fetchImpl(url) {
      if (url.endsWith('/results/')) return new Response('Invalid test-api-key', { status: 403 });
      return Response.json(url.endsWith('/exposures/') ? { exposures: null } : experiment);
    },
  }), /Read results for experiment 590 failed\. Error: HTTP 403 Invalid \[redacted\]/);
});
