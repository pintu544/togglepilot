'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { seededRandom, shouldConvert, recordAssignment, requireRunning, runCohort } = require('../simulator');
const { BATCH_SIZE, CONTROL_KEY, VARIANT_KEY, EXPERIMENT_ID, FLAG_NAME, METRIC_EVENT } = require('../simulator/src/constants');

test('the same seed produces the same conversion decisions', () => {
  function decisions(seed) {
    const random = seededRandom(seed);
    return Array.from({ length: 100 }, (_, index) =>
      shouldConvert(index % 2 === 0 ? CONTROL_KEY : VARIANT_KEY, random));
  }
  assert.deepEqual(decisions(590), decisions(590));
  assert.notDeepEqual(decisions(590), decisions(591));
});

test('conversion decisions use the assigned arm rate', () => {
  const samples = 100000;
  for (const [variant, expected] of [[CONTROL_KEY, 0.30], [VARIANT_KEY, 0.42]]) {
    const random = seededRandom();
    let conversions = 0;
    for (let index = 0; index < samples; index++) {
      if (shouldConvert(variant, random)) conversions++;
    }
    assert.ok(Math.abs(conversions / samples - expected) < 0.005);
  }
});

test('an identity cannot be recorded in two arms', () => {
  const assignments = new Map();
  recordAssignment(assignments, 'same-id', CONTROL_KEY);
  recordAssignment(assignments, 'same-id', CONTROL_KEY);
  assert.throws(() => recordAssignment(assignments, 'same-id', VARIANT_KEY), /two variants/);
  assert.equal(assignments.get('same-id'), CONTROL_KEY);
});

test('the simulator evaluates before tracking conversions and flushes each batch and at exit', async () => {
  const outcomes = [];
  const flushes = [];
  const conversions = [];
  let evaluated;
  const identities = Array.from({ length: BATCH_SIZE * 2 + 1 }, (_, index) => `test-${index}`);
  const client = {
    async getExperimentFlag(flag, identity) {
      assert.equal(flag, FLAG_NAME);
      evaluated = identity;
      return { enabled: true, variant: VARIANT_KEY, experiment: { id: EXPERIMENT_ID, inExperiment: true } };
    },
    trackEvent(event, { identifier }) {
      assert.equal(event, METRIC_EVENT);
      assert.equal(identifier, evaluated);
      conversions.push(identifier);
    },
    async flushEvents() { flushes.push(outcomes.length); },
  };
  await runCohort(client, identities, (outcome) => outcomes.push(outcome), { requireEnrollment: true });
  assert.deepEqual(outcomes.map(({ identity }) => identity), identities);
  assert.deepEqual(outcomes.filter(({ converted }) => converted).map(({ identity }) => identity), conversions);
  assert.deepEqual(flushes, [BATCH_SIZE, BATCH_SIZE * 2, identities.length, identities.length]);
});

test('pending events are flushed if processing fails', async () => {
  let flushed = false;
  const client = {
    async getExperimentFlag() { throw new Error('offline'); },
    async flushEvents() { flushed = true; },
  };
  await assert.rejects(runCohort(client, ['first'], () => {}), /offline/);
  assert.equal(flushed, true);
});

test('the full-run status guard refuses a created experiment', async () => {
  await assert.rejects(requireRunning('test-environment', 'test-key', async (url, options) => {
    assert.equal(new URL(url).pathname, `/api/v1/environments/test-environment/experiments/${EXPERIMENT_ID}/`);
    assert.equal(options.headers.Authorization, 'Api-Key test-key');
    return Response.json({ status: 'created' });
  }), /Full run refused.*must be running/);
  await requireRunning('test-environment', 'test-key', async () => Response.json({ status: 'running' }));
});
