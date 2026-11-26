'use strict';

const assert = require('node:assert/strict');
const { openSync, closeSync, writeSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseArgs } = require('node:util');
const {
  COHORT_SIZE, DRY_RUN_SIZE, CONTROL_CONVERSION_RATE, VARIANT_CONVERSION_RATE,
  FULL_IDENTITY_PREFIX, DRY_RUN_IDENTITY_PREFIX, BATCH_SIZE, FLAG_NAME,
  METRIC_EVENT, EXPERIMENT_ID, SEED, CONTROL_KEY, VARIANT_KEY,
} = require('./src/constants');

function seededRandom(seed = SEED) {
  // Numerical Recipes linear congruential generator, modulo 2^32.
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function shouldConvert(variant, random) {
  assert.ok(variant === CONTROL_KEY || variant === VARIANT_KEY, 'Unknown experiment arm.');
  return random() < (variant === CONTROL_KEY ? CONTROL_CONVERSION_RATE : VARIANT_CONVERSION_RATE);
}

function recordAssignment(assignments, identity, variant) {
  assert.ok(!assignments.has(identity) || assignments.get(identity) === variant,
    `Identity ${identity} was assigned to two variants.`);
  assignments.set(identity, variant);
}

async function requireRunning(environmentKey, apiKey, fetchStatus = fetch) {
  const url = 'https://api.flagsmith.com/api/v1/environments/' +
    `${encodeURIComponent(environmentKey)}/experiments/${EXPERIMENT_ID}/`;
  let response;
  try {
    response = await fetchStatus(url, {
      headers: { Authorization: `Api-Key ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`Could not check whether experiment ${EXPERIMENT_ID} is running. Check your connection.`);
  }
  if (!response.ok) throw new Error(`Experiment status check failed (HTTP ${response.status}).`);
  const { status } = await response.json();
  if (status !== 'running') {
    throw new Error(`Full run refused. Experiment ${EXPERIMENT_ID} must be running first.`);
  }
}

async function runCohort(client, identities, record, { requireEnrollment = false } = {}) {
  const random = seededRandom();
  const assignments = new Map();
  try {
    for (const [index, identity] of identities.entries()) {
      assert.ok(!assignments.has(identity), `Duplicate cohort identity ${identity}.`);
      let flag;
      try {
        // Node has no persistent identify() state. The SDK identifies this user
        // during evaluation and records an exposure when the user is enrolled.
        flag = await client.getExperimentFlag(FLAG_NAME, identity);
      } catch (error) {
        throw new Error(`Evaluation failed for ${identity}: ${error.cause?.message ?? error.message}`);
      }
      const variant = flag.variant ?? (flag.value === CONTROL_KEY ? CONTROL_KEY : undefined);
      assert.ok(flag.enabled && (variant === CONTROL_KEY || variant === VARIANT_KEY),
        `Missing or unexpected flag assignment for ${identity}.`);
      const enrolled = flag.experiment?.inExperiment === true &&
        String(flag.experiment.id) === String(EXPERIMENT_ID);
      assert.ok(!requireEnrollment || enrolled, `Identity ${identity} is outside experiment ${EXPERIMENT_ID}.`);
      recordAssignment(assignments, identity, variant);
      const converted = shouldConvert(variant, random);
      if (converted) client.trackEvent(METRIC_EVENT, { identifier: identity });
      record({ identity, variant, converted, enrolled });
      if ((index + 1) % BATCH_SIZE === 0 || index + 1 === identities.length) {
        await client.flushEvents();
      }
    }
  } finally {
    await client.flushEvents();
  }
}

async function main(args) {
  const { values } = parseArgs({
    args,
    options: {
      'dry-run': { type: 'boolean' },
      full: { type: 'boolean' },
      'identities-file': { type: 'string' },
    },
  });
  if (Boolean(values.full) === Boolean(values['dry-run'])) {
    throw new Error('Choose exactly one mode, --dry-run or --full.');
  }

  const sdkManifest = resolve(require.resolve('@flagsmith/nodejs'), '../../../package.json');
  const { version } = JSON.parse(readFileSync(sdkManifest, 'utf8'));
  console.log(`@flagsmith/nodejs ${version}`);
  const match = /^(\d+)\.(\d+)\.\d+(?:\+.+)?$/.exec(version);
  if (!match || !(Number(match[1]) > 9 || (Number(match[1]) === 9 && Number(match[2]) >= 1))) {
    throw new Error('Experiment events require @flagsmith/nodejs version 9.1.0 or newer.');
  }

  const environmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY;
  if (!environmentKey) throw new Error('Set FLAGSMITH_ENVIRONMENT_KEY before running the simulator.');
  if (values.full) {
    const apiKey = process.env.FLAGSMITH_API_KEY;
    if (!apiKey) throw new Error('Set FLAGSMITH_API_KEY so the simulator can check the experiment status.');
    await requireRunning(environmentKey, apiKey);
  }
  const { Flagsmith } = require('@flagsmith/nodejs');
  let eventDeliveryFailed = false;
  const client = new Flagsmith({
    environmentKey,
    enableEvents: true,
    retries: 0,
    requestTimeoutMs: 15000,
    eventProcessorConfig: { flushInterval: 0 },
    async fetch(url, options) {
      const response = await fetch(url, options);
      if (new URL(url).hostname === 'events.api.flagsmith.com') {
        const { events } = JSON.parse(options.body);
        const exposures = events.filter(({ event }) => event === '$flag_exposure').length;
        console.log(`Event submission HTTP ${response.status} (${exposures} exposures, ${events.length - exposures} conversions).`);
      }
      return response;
    },
    // The SDK resolves flushEvents even when it drops a batch. Surface that failure.
    logger: {
      debug() {},
      warn(message) {
        eventDeliveryFailed = true;
        console.error(message);
      },
    },
  });
  const count = values.full ? COHORT_SIZE : DRY_RUN_SIZE;
  const prefix = values.full ? FULL_IDENTITY_PREFIX : DRY_RUN_IDENTITY_PREFIX;
  const identities = Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
  let output;
  try {
    if (values['identities-file']) output = openSync(values['identities-file'], 'wx', 0o600);
    await runCohort(client, identities, (outcome) => {
      const line = JSON.stringify(outcome);
      if (output !== undefined) writeSync(output, line + '\n');
      console.log(line);
    }, { requireEnrollment: values.full });
  } finally {
    try {
      await client.close();
    } finally {
      if (output !== undefined) closeSync(output);
    }
  }
  if (eventDeliveryFailed) throw new Error('The SDK reported a failed event batch. See the delivery error above.');
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    let message = error.message;
    for (const key of [process.env.FLAGSMITH_ENVIRONMENT_KEY, process.env.FLAGSMITH_API_KEY]) {
      if (key) message = message.replaceAll(key, '[redacted]');
    }
    console.error(message);
    process.exitCode = 1;
  });
}

module.exports = { seededRandom, shouldConvert, recordAssignment, requireRunning, runCohort };
