# Scorecard — TogglePilot vs manual dashboard setup

> Measured during the window, never estimated. Claim locked at the top (T-0.3, by 13:00 IST 26 Nov 2026, Pintu confirms).

## Claim

**LOCKED 26 Nov 2026 13:57 IST — Pintu confirmed Safety.**
- (b) Safety — "TogglePilot catches the five silent failures that make experiments report zero; the dashboard catches none before launch."
- ~~(a) Speed — "TogglePilot sets up in *X* min what takes *Y* min by hand"~~ — STRUCK OUT: manual baseline ~2 min is too fast to beat on camera with margin.
- No third option; both claims are never carried.

## Measured numbers

| | Manual (dashboard) | TogglePilot |
|---|---|---|
| Wall-clock time | **~2 min** (09:04–09:06 IST, 26 Nov 2026) | **8.5 s** recorded from CLI start to creation and verification (~1.9 s from start to re-approval, ~6.6 s after approval). First-time human review excluded. |
| Surfaces/screens touched | **10** (see list below) | **1** (terminal CLI) |
| Silent-failure traps checked | **0 of 5** | **5 of 5 passed** |
| Approvals before anything mutates | n/a (no gate) | **3** required across the lifecycle (see gate status below) |

## How the TogglePilot side was measured

- The [Slice 1 run record](runs/2026-11-26T09-21-53.256Z/run-record.md) logs CLI start at `2026-11-26T09:21:51.367Z`, plan approval at `2026-11-26T09:21:53.256Z`, and execution finish at `2026-11-26T09:21:59.843Z`. The 8.5 s elapsed covers pre-flight, approval, and creation and verification of experiment 590 in the terminal. The ~1.9 s start-to-approval interval includes CLI work and a fast re-approval of an already-reviewed plan. First-time human reading and approval are excluded, and the record does not isolate human input within that interval. Post-approval execution took ~6.6 s. The run ended with the experiment created and unstarted.
- The record shows five passes covering the warehouse connection, variant keys and labels, metric event name, SDK versions, and instrumentation identity and event flushing. Slice 1 (T-1.2) separately verified that an unlabelled variant halted the run before anything was created.
- Gate 1 (plan) was exercised live in the recorded run. Gate 2 (start) is pending under T-2.3, with no start approval path in the checked-in CLI. Gate 3 (rollout) is implemented in `src/rollout.ts` and its live exercise is pending.
- A fresh full `togglepilot run` would create a second experiment on the same flag, so this scorecard uses the existing Slice 1 record. The locked claim remains **Safety**. The time row records the observed setup interval.

## Manual baseline record (T-0.2, 26 Nov 2026, browser task 09:01–09:07 IST)

- Environment: Flagsmith Cloud, org "tech bro" (41694), project TogglePilot (55638), **Production** environment (project has only Development and Production).
- Created: flag `headline_cta` (ID 304978, multivariate, Control "control" 50% / Variant_1 "shorter_headline" 50%), metric `cta_clicked` (ID 512, Occurrence, Higher is better), experiment `headline_cta_experiment` (ID 527, hypothesis "Shorter headline and clearer CTA will lift cta_clicked by at least 10% within 30 days", rollout 100%, split 50/50). Experiment is RUNNING — to be ended later so the flag is free for the agent run.
- Screens touched in order: (1) Features (Production) → Create Feature; (2) New Feature panel (name, Enabled by default, multivariate via "Create A/B/n Test"); (3) Features list + auto-opened Edit Feature panel; (4) Metrics list → Create Metric form; (5) Metrics list confirming metric; (6) Experiments list → Create Experiment wizard Step 1 Setup; (7) Step 2 Rollout configuration; (8) Step 3 Measurement; (9) Step 4 Review & Launch + confirmation modal; (10) Experiments list → experiment detail page (Running).
- Errors/hesitations: none inside the flow. Notes: one settings-page navigation timed out once (~09:03) and recovered on re-navigation; metric form warned "This event hasn't been received by your warehouse yet" (expected — no events sent yet); Experiments list briefly showed "Draft" right after creation while the toast said "created and started" and the detail page showed "Running" (detail page authoritative).
- Traps checked: 0 of 5 — the flow ran straight through with no separate trap checklist.

## Context for the claim decision

- The manual baseline took **~2 minutes**, far below the ~25 min estimate in the win research and below Flagsmith's own 5–7 min demo. A speed claim ("X min vs Y min") would need TogglePilot to beat ~2 min on camera with margin — unlikely to be compelling. This points toward the **safety claim (b)**, to be confirmed by Pintu at 13:00 IST.
- Warehouse: managed Flagsmith warehouse was already connected for Production before the window (connection present at 09:01 IST; 0 events received at that point; first-event processing "can take up to a few hours" per the dashboard). Test-fire event: see T-0.1 notes.
