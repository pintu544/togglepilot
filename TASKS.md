# TASKS — TogglePilot

> Ordered checklist. One task = one verifiable unit. Check off only when acceptance criteria pass.
> Window: **Thu 26 Nov 2026 08:00 IST → Sun 29 Nov 2026 20:00 IST** (hard close 20:00; submit target 18:00).
> Budget, locked by the win research: **agent build ≈ 40% · host app + simulator ≈ 20% · scorecard, video and README ≈ 40%.** The packaging share is deliberate — presentation is a scored layer, not an afterthought.
> Gates that are Pintu's and never skipped: this spec pack's approval before any build code; a quick confirmation from Pintu at each slice close; the pre-submission review before filing.

---

## Slice 0 — Window open: warehouse, baseline, claim (26 Nov, 08:00–13:00 IST)

*End-to-end outcome: the Flagsmith environment is proven ready for experiments, the manual baseline is measured on record, and the entry's single claim is locked from evidence.*

- [x] T-0.1: **Task 0 — connect the warehouse and test-fire (26 Nov, 08:00 sharp, before building anything)** — DONE 26 Nov 2026 ~09:15 IST (verified by parent via Management API): warehouse connection id 11218 (type flagsmith, created 24 Nov 10:39 UTC during account setup — already connected before the window); test identity togglepilot-test-001 identified via JS SDK, exposure + cta_clicked sent and flushed; API shows total_events_received: 2, unique_events_count: 2, last_event_received_at 26 Nov 03:41:44 UTC (09:11:44 IST). Status still "pending_connection" — first-event results processing can take up to a few hours per Flagsmith docs; event visibility is confirmed, full results processing is chased in Slice 2.
      Done means: managed warehouse enabled for the target environment (Environment Settings › Warehouse); a test identity is identified via the JS SDK with `enableEvents: true`, an exposure and a test event are sent and flushed; processing is confirmed (event visible in the warehouse via API — `total_events_received` ≥ 1). NOTE (amended 26 Nov 09:27 after Slice 0 QA): the dashboard status may still read `pending_connection` until first-event *processing* completes, which per Flagsmith docs can take up to a few hours — the status flip to `connected` is chased in Slice 2. If no events are visible by 13:00, escalate: re-check the connection, and shift Slice 1 work that does not depend on it earlier.
      Unblocks: everything — events sent to an environment with no warehouse are rejected, and no experiment result can exist without this.
- [x] T-0.2: **Measure the manual baseline (scorecard first — before any agent code)** — DONE 26 Nov 2026 ~09:06 IST (verified by Slice 0 QA 09:27): manual baseline ~2 min (09:04–09:06), 10 screens, 0 of 5 traps checked; numbers in scorecard.md verified verbatim against the daily log; flag 304978 / metric 512 / experiment 527 (RUNNING) confirmed live via API.
      Done means: the exact experiment TogglePilot will later create (same flag, variants, metric, rollout) is set up once by hand in the Flagsmith dashboard, screen-recorded and timed; the record states wall-clock minutes, surfaces/screens touched in order, every error or hesitation, and traps checked (expected: 0 of 5). Numbers written into `scorecard.md` in the repo — measured, never estimated. This recording is also the video's opening shot.
      Unblocks: T-0.3, T-3.1.
- [x] T-0.3: **CLAIM DECISION POINT — 26 Nov, by 13:00 IST, decided from T-0.2's numbers** — DONE 26 Nov 2026 13:57 IST: Pintu confirmed **Safety** — "TogglePilot catches the five silent failures that make experiments report zero; the dashboard catches none before launch." Speed struck out in scorecard.md (manual baseline ~2 min is too fast to beat on camera with margin).
      Done means: one claim is chosen and written at the top of `scorecard.md`, with the other explicitly struck out: **(a) Speed** — "TogglePilot sets up in *X* min what takes *Y* min by hand" (only if the baseline is beatable on camera with margin), or **(b) Safety** — "TogglePilot catches the five silent failures that make experiments report zero; the dashboard catches none before launch." No third option; both claims are never carried. Pintu confirms the choice.
      Unblocks: T-1.x prioritisation (validator is built first either way; the claim decides the demo's headline), T-3.1, T-3.3.
- [x] T-0.4: **Scaffold and credentials hygiene** — DONE 26 Nov 2026 ~09:14 IST (verified by parent): repo https://github.com/pintu544/togglepilot public, main ee7b287; TS/Node CLI shell (run/results/rollout stubs), credential guard verified live (run/rollout exit 1 without creds, stubs with dummy creds); .env.example + .gitignore (.env ignored, mode 600, not committed — verified via git ls-files + gh repo view: description + 7 topics landed, no homepage yet).
      Done means: repo created (TypeScript/Node CLI skeleton, no feature code yet beyond stubs), `.env.example` lists `FLAGSMITH_API_KEY` and `FLAGSMITH_ENVIRONMENT_KEY`, `.gitignore` covers `.env` and `runs/`, a startup check refuses mutating commands when credentials are absent (SPEC NFR-2). GitHub repo carries a description, homepage and topics per Pintu's standing rule.
      Unblocks: Slice 1.
- [x] T-0.5: **Slice 0 QA + Pintu confirmation** — DONE 26 Nov 2026 13:57 IST: Slice 0 QA passed 09:27 (2 narrow items, both fixed + pushed 09:29, commit 471aba8); Pintu confirmed the locked Safety claim at 13:57 IST. Slice 0 CLOSED.
      Done means: a fresh adversarial QA pass (not the builder) verifies the warehouse evidence and the baseline record are real artefacts (recording + numbers on disk, reproducible); Pintu confirms the locked claim. Slice closes only when both pass.

## Slice 1 — Validator, planner and approval-gated creation (26 Nov 13:00 – 27 Nov 13:00 IST)

*End-to-end outcome: `togglepilot run` takes a sentence to an approved, validated plan and creates a real flag, metric and experiment in Flagsmith — and refuses to create anything when a silent trap is present.*

- [ ] T-1.1: **Planner — sentence to ExperimentPlan**
      Done means: given "Test whether a shorter headline lifts clicks on my landing page", the CLI produces a complete plan (flag, ≥2 keyed variants, metric event + aggregation, rollout, split, hypothesis in Flagsmith's format: change + metric + expected effect + timeframe); schema-invalid drafts are rejected and the guided fallback flow produces the identical plan shape. Verified against 3 sample sentences + 1 fallback run.
      Unblocks: T-1.2, T-1.3.
- [ ] T-1.2: **Pre-flight validator — the five checks (headline differentiator)**
      Done means: all five checks from SPEC FR-2 run before any creation and print pass/fail + fix in plain English: warehouse connected (live API check), every variant keyed/labelled, metric event name exactly matching the app's event (case-sensitive), SDK versions ≥ minimums read from the target app's `package.json`, identity + `flushEvents()` present in the instrumentation. Any failure halts the run with nothing created — verified by running against a deliberately broken plan (unlabelled variant) and confirming zero Flagsmith objects exist afterwards.
      Unblocks: T-1.3; the planted-trap demo (T-3.3).
- [ ] T-1.3: **Approval gate 1 — review, edit, approve, reject**
      Done means: the plan is printed in full; the human can edit variant values, split, rollout % and event name, then approve or reject; rejection ends the run with nothing created (verified); the approved (possibly edited) plan is the one executed and the one saved to the run record.
      Unblocks: T-1.4.
- [ ] T-1.4: **Executor — create flag, variants, metric, experiment (no start)**
      Done means: on approval, flag + variants are created via Flagsmith CLI v2 and metric + experiment via REST (`POST .../experiment-metrics/`, `POST .../experiments/`); each object is re-read and verified after creation; a forced API failure surfaces the exact error and step, with no false success (SPEC NFR-3). The experiment exists in the dashboard, not started, flag not yet locked.
      Unblocks: T-1.5, Slice 2.
- [ ] T-1.5: **Instrumentation generator — React/TypeScript snippet**
      Done means: the CLI emits a snippet for the host app that initialises `@flagsmith/flagsmith` ≥12.4.0 with `enableEvents: true`, identifies with a persistent identity, records exposure via `getExperimentFlag`/`useExperiment` at the render point, tracks the exact metric event, and flushes; the snippet passes the validator's own check #5. Pasted into the host app in Slice 2 without hand edits.
      Unblocks: T-2.1.
- [ ] T-1.6: **Slice 1 QA + Pintu confirmation**
      Done means: fresh adversarial QA hunts the slice: malformed sentences, empty variant lists, splits not summing to 100, reserved `control` key misuse, credential leakage into output/logs, approval bypass attempts (no code path may create without the gate). Criticals fixed before close; Pintu runs one `togglepilot run` himself and confirms.

## Slice 2 — Host app, live experiment, results and rollout (27 Nov 13:00 – 28 Nov 18:00 IST)

*End-to-end outcome: a real experiment runs on a live app through the real pipeline, produces a readable verdict, and the winner is rolled out with the same flag on approval — the demo's climax, captured for real.*

- [ ] T-2.1: **Host app — one landing page, two variants, deployed**
      Done means: React + Vite page live on Vercel; the experiment flag serves two visibly different headline/CTA variants; the T-1.5 snippet is integrated unchanged; a manual click-through with two identities shows both variants rendering and a `cta_clicked` event tracked and flushed. Free-tier request count noted.
      Unblocks: T-2.2.
- [ ] T-2.2: **Simulator — disclosed seeded cohort, rates frozen**
      Done means: Node script on `@flagsmith/nodejs` ≥9.1.0 (remote evaluation only) walks 400 identities through identify → exposure → conversion at the committed rates (control ~30%, variant ~42%), flushing per batch; the rates live in one committed constants file, and the README disclosure text (cohort size + rates + "seeded, not organic") is written in the same task. Verified on a 20-identity dry run first: exposures appear, identities are distinct, no identity lands in two variants.
      Unblocks: T-2.3.
- [ ] T-2.3: **Start the real experiment — approval gate 2, then run the cohort (27 Nov)**
      Done means: the Slice 1 experiment is started via `POST .../experiments/<id>/start/` only after the second, separate approval; the simulator then runs the full 400; any real traffic from the live link is left to accumulate untouched. Simulator rates are not edited after this task starts — a hard rule, not a preference.
      Unblocks: T-2.4.
- [ ] T-2.4: **Results narrator — plain-English verdict**
      Done means: `togglepilot results` prints per-arm identities and conversions, lift, 95% credible interval, win probability, the results' "as of" time, and correctly renders all three states: "Collecting data" (floors not yet met), SRM warning if present, and a verdict. Refresh respects Flagsmith's once-per-5-minutes computation. Verified against the live experiment once floors clear (≥50 identities, ≥5 conversions per arm).
      Unblocks: T-2.5.
- [ ] T-2.5: **Rollout — approval gate 3, winner shipped with the same flag**
      Done means: when win probability > 95%, `togglepilot rollout` recommends the winner, and on the third explicit approval updates the flag so all users get the winning variation and ends the experiment; verified live (host app now serves the winner to a fresh identity). **Fallback, pre-agreed:** if the verdict is inconclusive at demo time, the narrator's honest "keep running" recommendation is the shown behaviour, and the rollout is demonstrated on the rehearsal experiment — decided by 28 Nov 18:00, never improvised on camera.
      Unblocks: Slice 3.
- [ ] T-2.6: **Scorecard completed with TogglePilot's measured side**
      Done means: the same experiment setup is timed through TogglePilot end to end (excluding human reading time, stated as such); `scorecard.md` now holds both measured columns — time, surfaces touched, traps checked 5 of 5, approvals 3 — ready to drop into README and video unchanged.
      Unblocks: T-3.1.
- [ ] T-2.7: **Slice 2 QA + Pintu confirmation**
      Done means: fresh adversarial QA verifies the experiment's data is real pipeline output (exposures panel, no double-variant identities, SRM state checked), the disclosure text matches the actual cohort and rates, and no credential or seeded/organic ambiguity exists anywhere in output. Pintu views the live results page and confirms the climax is demoable. Criticals fixed before close.

## Slice 3 — Packaging: README, video, review, submit (28 Nov 18:00 – 29 Nov 20:00 IST)

*End-to-end outcome: a judge can score all four criteria from the README alone, the ~3-minute video proves the claim on the real system, and the entry is filed before 20:00 after Pintu's pre-submission review.*
**Feature freeze: 29 Nov 12:00 IST — after that, packaging fixes only.**

- [ ] T-3.1: **README to the win formula**
      Done means: README in this exact order — one-line pitch → scorecard table (the locked claim, measured numbers) → live demo + video links → the one workflow → how Flagsmith is used (flag, metric, experiment, CLI + REST calls, and the sourced note that the MCP server cannot start experiments) → architecture (one diagram) → run it yourself in ≤10 minutes on the free tier → **honesty box** (seeded cohort: 400 identities, rates stated, never called organic; estimates labelled; AI tools used, disclosed) → what's next. Verified by the test in T-3.4: a reader can score all four criteria from the README alone.
      Unblocks: T-3.4.
- [ ] T-3.2: **Demo experiment rehearsal, full path**
      Done means: the complete demo path (sentence → planted trap caught → plan edited and approved → created → started → results → rollout) is rehearsed end to end once on a rehearsal experiment, timed, with every screen the video needs confirmed working; free-tier request total checked against the 50k cap.
      Unblocks: T-3.3.
- [ ] T-3.3: **Demo video — ~3 minutes, to the formula**
      Done means: final cut follows the structure: 0:00–0:25 the problem with the measured baseline number (T-0.2 recording) → 0:25–0:40 one-sentence pitch on screen → 0:40–1:30 TogglePilot working live against the real Flagsmith project, including the **planted unlabelled-variant trap caught by the validator on camera** → 1:30–2:10 the human edits one value and approves → 2:10–2:45 the real results page and the winner rolled out with the same flag → 2:45–3:00 scorecard end card plus the one-line seeded-cohort disclosure. Every number spoken appears on screen; no feature is mentioned that is not shown working; narration claims nothing the screen does not prove.
      Unblocks: T-3.4.
- [ ] T-3.4: **Pre-submission review with Pintu (his standing gate — nothing files before this)**
      Done means: projected score per criterion (Use of Flagsmith, Impact, Creativity, Demo video) written down with the evidence for each; the README-alone test passed by a fresh reader/QA pass; deadline discrepancy noted (plan stands: file to the 20:00 close); Pintu approves the package — repo, README, video, live links — explicitly.
      Unblocks: T-3.5.
- [ ] T-3.5: **Submit — target 18:00, hard deadline 20:00, 29 Nov**
      Done means: submission filed on WeMakeDevs with repo + README + demo video; the confirmation is screenshotted/saved to the repo's submission record; live links clicked through once more post-filing (host app up, experiment results page reachable, video plays). Nothing is edited after filing except through the event's own change path if Pintu directs it.
      Unblocks: nothing — entry complete.

---

### Schedule at a glance (IST)

| When | Block | Share |
|---|---|---|
| 26 Nov 08:00–13:00 | Slice 0 — warehouse test-fire, baseline, claim locked | — |
| 26 Nov 13:00 – 27 Nov 13:00 | Slice 1 — validator, planner, gates, creation | build ≈ 40% (with Slice 2's narrator) |
| 27 Nov 13:00 – 28 Nov 18:00 | Slice 2 — host app, simulator, live experiment, rollout | host app + simulator ≈ 20% |
| 28 Nov 18:00 – 29 Nov 20:00 | Slice 3 — README, video, review, submit (freeze 29 Nov 12:00) | packaging ≈ 40% |
