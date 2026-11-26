# SPEC — TogglePilot

> Requirements. Testable, implementation-free. One page.
> Toggle Wars: The Flagsmith Experimentation Hackathon (WeMakeDevs × Flagsmith), **Track 02 — AI Agents and Feature Flags**. Solo entry. Hacking window: **26 Nov 2026 08:00 IST – 29 Nov 2026 20:00 IST** (the 20:00 close is the deadline we plan to; a social post claiming 23:59 is treated as grace, never schedule).
> Sources: `research.md` and `how-to-win.md` in this folder. Every requirement below traces to one of them.

## Problem

Setting up one A/B experiment in the Flagsmith dashboard means working across four surfaces (warehouse, multivariate flag, metric, experiment wizard) and then hand-writing SDK instrumentation — and the platform fails *silently* in five known ways (no warehouse connected, unlabelled variants, event-name case mismatch, event-incapable SDK versions, missing identity or event flush), each of which makes an experiment report zero data with no error shown. A developer who wants to test a change loses the best part of an hour to setup toil and can still end up with an experiment that was never collecting anything. Flagsmith's own free coding-agent prompt does the naive version of this setup, but it has no approval gates, no pre-flight validation, and no results interpretation or rollout step.

## Users

- **The experimenting developer** — a solo dev or small-team engineer who wants to run a real A/B test on their app without dashboard toil or silent setup failures. Primary user; Pintu himself is user zero.
- **The approver** — the same developer wearing a second hat: reviews, edits, approves or rejects every change TogglePilot proposes before anything in Flagsmith mutates. (Track 02 judging line: "A human approves changes.")
- **The judge** — a community-recruited evaluator skimming 1,000+ entries; must be able to score all four criteria from the README's first screen and the video's first 30 seconds.

## Functional Requirements

- FR-1: The system SHALL accept a plain-language description of an experiment (what to test, what counts as success) as a single CLI input and turn it into a complete, structured experiment plan: flag name, at least two variants each with a key/label, metric (event name + aggregation type), rollout %, variation split, and a hypothesis written in Flagsmith's format — change + metric + expected effect + timeframe.
- FR-2: The system SHALL run a **pre-flight validation before creating anything in Flagsmith**, checking all five silent killers and reporting each in plain English with a pass/fail and a fix: (1) a warehouse is connected for the target environment; (2) every variant in the plan has a key/label; (3) the metric's event name exactly matches the event the app will send, case-sensitively; (4) the target app's Flagsmith SDK versions are at or above the event-capable minimums (`@flagsmith/flagsmith` 12.4.0+, `@flagsmith/nodejs` 9.1.0+ where present); (5) the generated instrumentation identifies the user and flushes events.
- FR-3: The system SHALL NOT create, modify or start anything in Flagsmith while any pre-flight check fails; it SHALL stop, show the failing checks, and wait.
- FR-4: The system SHALL present the plan for human review before any mutation, and the human SHALL be able to approve it, edit any value in it (at minimum: variant values, split, rollout %, metric event name), or reject it. No Flagsmith object SHALL be created before approval.
- FR-5: On approval, the system SHALL create the multivariate flag and its variants (Flagsmith CLI), then create the metric and the experiment (REST Management API: `POST .../experiment-metrics/`, `POST .../experiments/`). Experiment creation and starting SHALL NOT use the Flagsmith MCP server, which cannot start experiments.
- FR-6: The system SHALL generate the SDK instrumentation for the target app as a React/TypeScript snippet that: initialises `@flagsmith/flagsmith` (12.4.0+) with `enableEvents: true`, identifies the user with a persistent identity, records the exposure at the point of experience (`getExperimentFlag` / `useExperiment`), tracks the conversion event with the exact metric event name, and flushes events (`flushEvents()`).
- FR-7: The system SHALL require a **second, separate human approval** before starting the experiment (`POST .../experiments/<id>/start/`), distinct from the plan approval in FR-4.
- FR-8: The system SHALL report experiment status on request in plain English: identities enrolled per arm, conversions, lift vs control, 95% credible interval, win probability, and whether results are still withheld ("Collecting data" — fewer than 50 identities or fewer than 5 conversions in an arm) or blocked by a Sample Ratio Mismatch warning.
- FR-9: When a variation's win probability exceeds 95%, the system SHALL recommend rolling out the winner, and SHALL — only on a third explicit human approval — roll the winner out by updating the same flag so all users receive the winning variation, then end the experiment.
- FR-10: The system SHALL ship with one small host app (a single landing page) on which TogglePilot runs one real experiment end to end during the window: two visibly different headline/CTA variants behind the experiment flag, with `cta_clicked` (Occurrence) as the metric event.
- FR-11: The experiment in FR-10 SHALL be populated through the real Flagsmith pipeline (identified identity → exposure → conversion event → warehouse → Bayesian results) using a **disclosed seeded cohort of 400 identities** driven by a simulator script, plus any real traffic the live host-app link gathers. The cohort size and its stated conversion rates SHALL be disclosed in the README, the demo video and the results readout, SHALL never be described as organic traffic, and the simulator's rates SHALL NOT be changed after the experiment starts.
- FR-12: The system SHALL produce a **scorecard** comparing the manual dashboard setup of the same experiment against TogglePilot, measured — not estimated — during the window: wall-clock time, surfaces/screens touched, silent-failure traps checked (0 of 5 manual vs 5 of 5 TogglePilot), and approvals required before anything mutates. The scorecard SHALL appear in the README and as the demo video's end card.
- FR-13: The system SHALL print a clear, human-readable record of everything it did (plan, approvals, API results, experiment ID, results link) for every run, so the whole session can be followed without opening the Flagsmith dashboard.

## Non-Functional Requirements

- NFR-1: Performance — a full approved run (plan → validate → create → instrument → start) SHALL complete in under 5 minutes of wall-clock time excluding the human's own reading/approval time, and SHALL beat the measured manual baseline (FR-12) on camera; if it cannot, the claim pivots per the decision point in TASKS.md (Slice 0).
- NFR-2: Security — Flagsmith credentials SHALL be read from environment variables only, never written into the repository, the plan output, the README or the video; the CLI SHALL refuse to run a mutating command when no credential is configured.
- NFR-3: Reliability — every Flagsmith API failure SHALL be surfaced with the exact error and the step that failed; the system SHALL never report success for a step it did not verify (flag/metric/experiment existence is re-read after creation).
- NFR-4: Cost — the whole entry SHALL run on the Flagsmith Cloud Free tier (50,000 API requests/month, 100,000 experiment users); the seeded cohort and rehearsal runs SHALL be budgeted so total requests stay visibly below the cap, and the count SHALL be checked during rehearsals.
- NFR-5: Explainability — Pintu SHALL be able to explain every part of the system unaided (an event rule: "you still need to understand and explain what you built"); no component may be included whose behaviour cannot be explained in two sentences.

## Out of Scope

- **No web dashboard or GUI for TogglePilot** — the CLI plus its printed plan/results output is the interface.
- **React/TypeScript instrumentation snippets only** — no Vue, Angular, mobile or backend-framework snippet generators (the Node server-side pattern is documented in the README, not generated).
- **No monitoring or alerting product** — no scheduler, no watch loop, no notifications; results readout is a single on-demand command.
- **No multi-project or multi-environment management** — one Flagsmith project, one environment, per run.
- **No Track 01 or Track 03 entry** — the live experiment exists inside the Track 02 demo only; no self-hosted Flagsmith work.
- **No general flag-management tool** — no flag CRUD beyond what the experiment lifecycle needs (create flag/variants, read state, roll out winner, end experiment).
- **No user accounts, billing, or hosted TogglePilot service** — it runs locally against the user's own Flagsmith project.
- **No tuning of the seeded cohort after launch, and no presenting seeded traffic as organic** — ever, under any deadline pressure (see FR-11).

## Judging Criteria (hackathons only)

Published scorecard: Use of Flagsmith · Impact · Creativity · Demo video. Track 02 specifics: "Flagsmith CLI, API or MCP server · Saves real time · A human approves changes · Clear output."

- **Use of Flagsmith** → FR-2, FR-5, FR-6, FR-8, FR-9: the full experimentation lifecycle (warehouse check → flag → metric → experiment → start → results → rollout) is the product's entire job; removing Flagsmith removes TogglePilot.
- **Impact** → FR-2, FR-3, FR-12: kills the five silent setup failures that waste real teams' experiments, and proves the time saving with a measured scorecard rather than a claim.
- **Creativity** → FR-2, FR-4, FR-8, FR-9: the deliberate distance from Flagsmith's free official prompt — pre-flight validation before anything is created (the prompt only stops after errors), approval gates with editing, plain-English results narration, and rollout of the winner; the prompt does none of these and is a prompt, not a product.
- **Demo video** → FR-10, FR-11, FR-12: a completed real experiment as the climax, a planted pre-flight trap caught on camera, a human editing and approving the plan, the winner rolled out live, and the measured scorecard as the end card.
- **Track 02 lines, one by one** → CLI/API use: FR-5 (CLI + REST; MCP explicitly not used for start, with the reason stated). Saves real time: FR-12 (measured). A human approves changes: FR-4, FR-7, FR-9 (three gates). Clear output: FR-1, FR-8, FR-13 (plan, verdict and run record in plain English).
