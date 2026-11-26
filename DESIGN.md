# DESIGN — TogglePilot

> Architecture and contracts. Written after SPEC.md is stable.
> Track 02 entry, Toggle Wars (WeMakeDevs × Flagsmith). Build window 26–29 Nov 2026, all times IST.

## Architecture

TogglePilot is a single TypeScript/Node CLI with five components in one process, plus two satellite artefacts (a host app and a simulator) that exist to give the demo a real experiment. One diagram in words:

**Intake → Planner → Validator → Executor (approval-gated) → Reporter**, with Flagsmith Cloud as the only external system the Executor mutates.

- **CLI shell** (`togglepilot` command, subcommands `run`, `results`, `rollout`): parses arguments, drives the interactive approval prompts, prints all output. No other interface exists (SPEC out-of-scope: no dashboard).
- **Planner**: takes the user's plain-language sentence plus a small set of structured answers (app path, flag name, metric event) and drafts an `ExperimentPlan` (see Data Model). Drafting uses an LLM call constrained to a strict JSON schema; the draft is then validated locally field-by-field. If the LLM is unavailable or returns invalid JSON, the Planner falls back to a guided question flow that builds the same plan deterministically — the plan, not the model, is the product.
- **Validator** (the headline component): runs the five pre-flight checks from SPEC FR-2 against (a) the plan, (b) the target environment via the Management API (warehouse connection), and (c) the target app's source (`package.json` dependency versions; the generated snippet's contents). Pure checks, no mutation. Any failure halts the run with a plain-English report and the fix for each failure.
- **Executor**: the only component allowed to mutate Flagsmith, and only behind the approval gates. Flag and variants via the Flagsmith CLI v2 (subprocess); metric, experiment and start via the REST Management API. After each mutating call it re-reads the created object to verify it exists as intended before proceeding (SPEC NFR-3).
- **Reporter**: two modes. *Run record* — prints and saves a Markdown log of the session (plan, check results, approvals given, IDs created, results link). *Results narrator* — reads experiment results via the API and renders the plain-English verdict (FR-8), including the "Collecting data" and SRM states, and the rollout recommendation when win probability > 95%.
- **Host app** (satellite): a one-page React + Vite landing page with two headline/CTA variants behind the experiment flag and a `cta_clicked` conversion. Deployed to Vercel. It is a demo vehicle, deliberately tiny, and the only surface the experiment runs on.
- **Simulator** (satellite): a Node script using `@flagsmith/nodejs` (remote evaluation) that walks 400 disclosed synthetic identities through the real pipeline — identify, `getExperimentFlag` (exposure), convert at the stated fixed rates, `flushEvents()`. Rates are constants in one file, committed before the experiment starts and never edited afterwards (SPEC FR-11).

## Data Model

TogglePilot holds no database. Its state is three file shapes plus Flagsmith itself:

- **ExperimentPlan** (JSON, produced by the Planner, edited at the approval gate, saved with the run record): `flagName`, `variants[]` each `{ key, label, value }` (the flag's own value is the control; `control` is a reserved key and is never used as a variant key), `metric { eventName, aggregation: occurrence|count|sum|mean, direction }`, `rolloutPercent`, `variationSplit[]` (percentages summing to 100, control takes the remainder), `hypothesis` (change + metric + expected effect + timeframe), `environment`, `appPath`.
- **PreflightReport** (JSON + printed): five entries `{ check, status: pass|fail, detail, fix }` — warehouse, variant keys, event-name match, SDK versions, identity/flush in instrumentation.
- **RunRecord** (Markdown + the plan JSON, one folder per run under `runs/`): timestamps, approvals, CLI/API calls made, returned IDs, results URL. This is the audit trail the README and video draw on.
- **Flagsmith-side entities** (the real data): multivariate flag + variants, metric, experiment — all in one project, one environment, on the Cloud Free tier with the managed warehouse connected.

## API Contracts

All Flagsmith calls use the environment key in the path, per the official coding-agent guide (`research.md` §2.4). Auth: Management API key from the `FLAGSMITH_API_KEY` environment variable; environment key from `FLAGSMITH_ENVIRONMENT_KEY`. Neither is ever printed or committed (SPEC NFR-2). **Verified 26 Nov 2026: organisation API keys authenticate as `Authorization: Api-Key <key>` — the `Token` scheme returns 401 "Invalid token". Slice 1's Executor MUST use the `Api-Key` header.**

- **Check warehouse** — `GET api/v1/environments/<environment key>/warehouse-connections/` → 200 with at least one connection = pass; empty/absent = pre-flight failure #1.
- **Create flag + variants** — Flagsmith CLI v2 (subprocess, JSON captured):
  - `flagsmith feature create <flag> --value control --enabled`
  - `flagsmith feature variant add <flag> --value <value> --key <key> --weight 0` (weight set by the experiment, not the flag)
  - `flagsmith feature get <flag> --json` → verification re-read.
- **Create metric** — `POST api/v1/environments/<environment key>/experiment-metrics/` with `{ name, aggregation, event name }` → returns metric ID; existence verified by the experiment creation referencing it.
- **Create experiment** — `POST api/v1/environments/<environment key>/experiments/` with `{ flag ID, name, hypothesis, primary metric, rollout, multivariate_feature_state_values[] each with percentage_allocation }` → returns experiment ID.
- **Start experiment** — `POST api/v1/environments/<environment key>/experiments/<id>/start/` → called only after the second approval gate; starting locks the flag and turns on the rollout.
- **Read results** — experiment/results read via the Management API for the experiment ID → per-variation exposures, metric values, delta, 95% credible interval, win probability, SRM/collecting-data status; rendered by the Reporter. (Results are computed on demand in Flagsmith, refreshable at most once every 5 minutes — the narrator states the "as of" time.)
- **Roll out winner** — update the same flag so 100% of users receive the winning variation (flag update via CLI/API), then end the experiment — only after the third approval gate.
- **Explicitly not used**: the Flagsmith MCP server for experiment creation or start — per Flagsmith's own guide, it cannot start experiments. The REST endpoints above are the start path. This is stated in the README as a deliberate, sourced decision.
- **Host-app SDK contract** (`@flagsmith/flagsmith` 12.4.0+): `init({ environmentID, enableEvents: true })` → `identify(persistentId)` → `getExperimentFlag('headline_cta')` at the point of experience, render by `flag.value`/`flag.variant` → on CTA click `trackEvent('cta_clicked')` → `flushEvents()` on unload/route change.

## Key Decisions

- Decision: **CLI is the only interface** — Rationale: scope lock from the win research; a dashboard would eat the window and add nothing a judge scores. (Rejected: a web UI; a chat interface.)
- Decision: **Validator runs before any creation, and halts the run on any failure** — Rationale: it is the headline differentiator from Flagsmith's free prompt, which only stops *after* errors; catching the five silent killers first is the Creativity + Impact story. (Rejected: validate-as-you-go interleaved with creation.)
- Decision: **Three separate human approval gates** (plan, start, rollout), with editing offered at the plan gate — Rationale: "A human approves changes" is a named Track 02 judging line; gates must be visible, and the demo shows one edit, not just approvals. (Rejected: a single up-front approval; auto-start after creation.)
- Decision: **CLI for flag/variants, REST for metric/experiment/start** — Rationale: matches the official recipes, and REST is the only programmatic start path since the MCP server cannot start experiments. (Rejected: MCP-first; pure-REST for everything — the CLI also evidences the track's "CLI, API or MCP" line twice over.)
- Decision: **Experiments run in remote evaluation only; the Node SDK is never put in local-evaluation mode for experiment traffic** — Rationale: Flagsmith supports experimentation with remote evaluation only today; local mode would silently produce no experiment data. (Rejected: local evaluation for speed.)
- Decision: **Managed Flagsmith warehouse on Cloud Free; no self-hosting** — Rationale: BYOW is Scale-Up/Enterprise-only on Cloud, self-hosting is Track 03's game and pure ops overhead in an 84-hour window; free tier (50k requests, 100k experiment users) is ample for one experiment plus a 400-identity cohort. (Rejected: self-hosted Flagsmith; BYOW PostgreSQL.)
- Decision: **Host app is a single landing page with a `cta_clicked` Occurrence metric** — Rationale: clicks give a high baseline rate (~30%), so the ≥50 identities / ≥5 conversions per arm floors and a readable verdict are reachable with 400 identities; a purchase metric at ~2% would strand the demo at "Collecting data". (Rejected: signup-completion funnel; pricing-page test — both fine experiments, more build.)
- Decision: **Seeded cohort fixed at 400 identities, 100% rollout, 50/50 split, control conversion ~30%, variant ~42%, rates committed before start and never retuned** — Rationale: clears both floors per arm with margin (~200 identities, ~60 vs ~84 expected conversions per arm), uses Flagsmith's own sanctioned simulator pattern, and the fixed-rates rule plus disclosure everywhere keeps it honest; SRM checks would expose a rigged split. (Rejected: smaller cohort — verdict risk; organic-only traffic — unreachable volume in the window.)
- Decision: **The claim is decided by measurement on 26 Nov, not in this document** — the scorecard's speed claim stands only if TogglePilot beats the timed manual baseline on camera; otherwise the claim pivots to safety (five traps caught before launch vs zero in the dashboard flow). One claim, proved — never both. The decision point and its date are a task in TASKS.md (Slice 0).
- Decision: **Planner's LLM drafting is schema-constrained with a deterministic guided-flow fallback** — Rationale: the demo must never depend on a model call succeeding live; the plan object is identical either way. (Rejected: free-form agent tool-calling as the core loop — unexplainable and fragile, against NFR-5.)
- Decision: **Host app deployed to Vercel; TogglePilot itself runs locally and is not hosted** — Rationale: only the host app needs a public URL (for real traffic and judge click-through); Azure remains the fallback host if Vercel deploys stall. (Rejected: hosting the CLI; Azure-first for a static Vite page — slower path for this artefact.)

## Risks

1. **Warehouse processing lag sinks the demo timeline** — the first warehouse event "can take up to a few hours" to process, and events for an environment with no warehouse are rejected outright. De-risked by schedule, not code: Task 0 at 08:00 on 26 Nov connects the warehouse and test-fires an event before anything is built, and processing is confirmed before Slice 1 ends; the real experiment is started on 27 Nov so results exist by 28 Nov.
2. **The scorecard claim fails** — Flagsmith's own demo does the manual setup in 5–7 minutes, so TogglePilot may not be dramatically faster end-to-end. De-risked by the pre-committed pivot (Key Decisions): measure first on 26 Nov, and if the speed claim is weak, the entry's claim becomes the safety story — five silent traps caught pre-launch — which needs no stopwatch luck. The validator is built either way; only the headline changes.
3. **Results land inconclusive** — credible interval crossing zero or win probability stuck between 5% and 95% would blunt the demo climax and the FR-9 rollout. De-risked by design: bold variant difference, high-baseline metric, 400-identity cohort sized for ~60 vs ~84 conversions, experiment started early (27 Nov) so refresh cycles accumulate. If it still lands inconclusive, the demo narrates the honest verdict and the *recommendation* (keep running) — the rollout step is then shown on the rehearsal experiment instead; this fallback is written into TASKS.md so it is a plan, not a scramble.
