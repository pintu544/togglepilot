# TogglePilot simulator

The simulator uses plain Node.js in CommonJS to match the root CLI runtime and `node --test` suite. Its standalone package runs directly without a separate compilation step.

From the repository root, with Node.js 20+ and the Flagsmith keys in `.env` as shown in `.env.example`:

```sh
npm ci --prefix simulator
node --env-file=.env simulator --dry-run --identities-file runs/dry-run.jsonl
node --env-file=.env simulator --full --identities-file runs/full.jsonl
```

Use exactly one mode. The dry run evaluates 20 identities with a separate prefix. The full run evaluates 400 identities and requires `FLAGSMITH_API_KEY` to verify that experiment 590 is running. Both use `FLAGSMITH_ENVIRONMENT_KEY` for remote SDK calls. The CLI prints the installed SDK version and requires 9.1.0 or higher.

The Node SDK identifies each user through the identifier passed to `getExperimentFlag`. Flagsmith assigns the arm, and the SDK queues an exposure for an enrolled identity. The simulator uses a fixed random seed to decide whether to send an identified `cta_clicked` event at the assigned arm’s conversion rate. It flushes every 20 identities and again on exit. The optional JSON Lines file records the identity, variant, conversion decision, and SDK enrollment status. Use a new file path for each audit. The identity prefixes are stable, so repeating a mode reuses the identities and can submit more events.

## Seeded cohort disclosure

The experiment includes a simulator cohort of 400 identities. Each identity receives its arm from Flagsmith, then the simulator generates conversions at a fixed probability of about 30% for control and 42% for the variant. This traffic is seeded, not organic. The rates were committed before the experiment started and are frozen after start.

The probabilities in `src/constants.js` are frozen for experiment 590. Never change them after the experiment starts.

## Flagsmith Cloud Free request budget

A successful full run without retries makes **421 API calls**. That includes one Management API status check, 400 remote identity evaluations, and 20 event batch submissions. The final empty flush makes no request. The SDK can retry each failed event submission once, for up to 441 calls. This is below the 50,000 monthly request and 100,000 experiment user limits. The dry run budgets 20 evaluations and up to one event submission before retries, plus any separate audit reads.
