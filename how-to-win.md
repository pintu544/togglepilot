# How to Win Toggle Wars — the Flagsmith Experimentation Hackathon

**For:** Pintu Kumar (solo, registered). **Researched:** 19 Nov 2026 — one week before hacking starts (26 Nov 08:00 IST – 29 Nov 20:00 IST).
**Companion file:** `research.md` in this folder (mechanics, SDK traps, rules, the TogglePilot concept). This file answers a different question: not *how the product works*, but *what wins, and why Pintu's previous entries did not*.
**Pintu's instruction, honoured throughout:** "First research how to win the hackathon, because we started building early and fast, and none of the hackathons won."

**The one-sentence conclusion:** Every piece of evidence — WeMakeDevs' own past winners, Flagsmith's own marketing, and the scored wreckage of Pintu's previous entries — points the same way: **the winner is not the biggest build; it is the entry built around one measurable, verifiable claim, proved live on the real sponsor system, with the sponsor's product load-bearing and a human visibly in control.** TogglePilot survives this test, but only with three mandatory changes (§5.3): a timed head-to-head scorecard as its central claim, a demo that ends with a winner actually rolled out, and a pre-flight validator for Flagsmith's silent-failure traps.

---

## 1. What won previous WeMakeDevs hackathons

WeMakeDevs runs sponsor hackathons continuously (Switch, FalkorDB, Wispr, AWS, Modiqo, Bright Data…). The winners are announced on their Telegram/Instagram and written up by the builders. Six data points, each with a lesson that transfers directly to Toggle Wars:

### 1.1 No Hands — the Wispr Challenge (voice, Oct 2026)

Winners announced on the WeMakeDevs Telegram channel (https://t.me/s/WeMakeDevs):

- **NoHandsPilot** (Builders Track, ₹1 lakh): a voice-controlled Mac assistant — open apps, switch tabs, search the web, entirely by voice.
- **Hot Seat** (No-Code Track, ₹1 lakh): AI pitch practice that checks a deck for inconsistencies and simulates investor questions.
- Daily $100 winners included **VoiceTrace** — "turns bug reporting from a 10-minute typing task into a 10-second voice note" — and **Spec Whisper**, which turns rough ideas into structured instructions for AI coding agents.

**Pattern:** every winner is described in one sentence, solves a problem from the builder's *own* work, and the best ones carry a **quantified before/after** (10 minutes → 10 seconds). Nobody won with a platform, a framework, or a dashboard of everything.

### 1.2 Graph Hacks — WeMakeDevs × FalkorDB

Winners (WeMakeDevs Telegram, https://t.me/s/WeMakeDevs): Arnab Saha — "Agents That Act on Connected Data" (iPhone 18 Pro); Aymaan Pathan — "Agent Memory and Coordination" (PS5 + GTA VI); Shreyash Mandal — "Company Brain" (Mac mini).

**Pattern:** the sponsor's product (FalkorDB's graph) is not a storage choice in these projects — it is the *mechanism*. "Agents that act on connected data" is a sentence about the sponsor's core capability doing the work. This is the exact shape of Toggle Wars criterion 1, "Use of Flagsmith — flags and experiments do real work" (event page, quoted in `research.md` §3).

### 1.3 Flip the Switch — WeMakeDevs × Switch AI (Nov 2026, $10,000) — the closest analogue

This is the most instructive event: same organiser, same month, same "AI agents + sponsor platform" shape as Toggle Wars Track 02. Three finalist-grade write-ups survive:

- **Tryouts** (https://www.aryankumar.dev/blogs/tryouts-ai-coder-hiring-switch): Claude Code, Codex and OpenCode race to fix the same bug; plain-code checks verify each fix; the team lead "hires" one with a single approval button in Slack. The write-up's centrepiece is **a real scoreboard from the run in the video** — candidate, verified result, tests passed, time, estimated cost — with the honest footnote that the dollars are list-price estimates. One-line pitch: "hire your AI coder the way you'd hire a person." Every merge commit carries the proof (the referee's digest, who was hired and why, the numbers that won).
- **Switch Studio** (https://medium.com/@vivek.neuralvibe/how-do-you-stop-an-ai-agent-from-publishing-claims-your-repo-cannot-support-ddd6d11e99d4): a team that had just lost a previous hackathon diagnosed itself in print — *"We had built something decent, but we had no way to prove it was decent… the winning team had a clear answer to a question we never asked ourselves: who is this for, and how do you know it works?"* Their Flip the Switch entry was built entirely around that lesson: an agent pipeline where **no sentence ships unless it points to a real commit, file or number, and a human approves it** — then measured: plain output scored 50% of sentences supported; Studio scored 100%. Note the structure: a measurable claim, a human approval gate, and a before/after score. That is Track 02's judging list ("saves real time · a human approves changes · clear output") wearing different clothes.
- **Switch Gear** (https://dev.to/adybose/i-let-ai-agents-build-and-run-my-t-shirt-store-from-slack-in-just-24-hours-58k2): a T-shirt store run by AI agents in Slack with exactly one human. Crucially, the write-up discloses its own seams in the second paragraph: *"It's a demo store: payments, printing, couriers and most orders are simulated. The agents, the Slack channels and the code are real."* Disclosure did not weaken the entry; it is what makes the real parts believable.

### 1.4 Environmental Hacks — WeMakeDevs × AWS (Oct 2026)

Runner-up (one of 4, from 9,146 registered, solo): **Teesri Shikayat** — a tripwire for dirty tap water: Hindi voice complaints on Telegram; when three homes close together report it, every home around them is warned; only residents can close the case (https://www.aryangorde.com/).

**Pattern:** a hyper-specific real problem, a mechanism you can state in one breath, and a constraint that makes it feel designed rather than generated ("only the residents can close the case"). The same builder's Rote Playoffs win came from *finding a real defect in the sponsor's runtime* (output silently truncated at 64 KiB) and fixing it upstream — deep, docs-and-source-level engagement with the sponsor's product beat feature-building.

### 1.5 Patch the Conference — WeMakeDevs × Bright Data (Oct 2026, in-person)

The winning team's own write-up (Hero Goggles, https://docs.infrared.darkshift.io/blog/hero-goggles-at-the-cloud-native-hackathon/) states their design rule explicitly: *"We did not want a logo on a slide for each [sponsor]. We wanted each product doing real work inside Hero Goggles, so that taking it out would break something."* They also published their numbers ("29 deployments… 27 of them Released, from about 70 commits") — again, a scorecard.

### 1.6 What the winners have in common

1. **A one-sentence pitch** a judge can repeat to another judge (hire an AI coder like a person; a tripwire for dirty water; bug reports in 10 seconds).
2. **The sponsor's product is the mechanism**, not an integration. Remove it and the project collapses.
3. **A measurable claim, proved on the real system, presented as a scorecard** — times, costs, percentages, counts from the actual run in the video (Tryouts, Switch Studio, VoiceTrace, Hero Goggles).
4. **A narrow, finished scope.** One workflow, end to end, no dead ends, no "coming soon" panels.
5. **A specific, real problem** — usually the builder's own — with one designed constraint that shows taste.
6. **Honest seams.** Simulated parts are labelled simulated; estimates are labelled estimates. Judges reward this because it makes the real claims credible.

---

## 2. Flagsmith's own signals — what the sponsor celebrates

### 2.1 Who is actually judging

Not necessarily Flagsmith engineers. WeMakeDevs is recruiting the panel by open application: *"Be a judge at Toggle Wars… We're bringing together experienced voices from the developer ecosystem to evaluate the submissions and select the winners"* (https://twstalker.com/WeMakeDevs). With 1,000+ registrations announced, judges will skim. **Implication:** the first 30 seconds of the demo video and the first screen of the README carry disproportionate weight; insider cleverness that takes ten minutes to explain will not be seen.

Kunal Kushwaha's framing of the event (https://twstalker.com/kunalstwt; Flagsmith LinkedIn, https://uk.linkedin.com/company/flagsmith): *"[It] goes a step past 'it works'. You build something with Flagsmith feature flags, ship two versions of a feature, run a real A/B test and let the data tell you which one wins. That's how product decisions get made at good companies."* The phrase to internalise is **"a step past 'it works'"** — a working demo is the floor, not the differentiator. The differentiator is a *decision made from data*.

### 2.2 Flagsmith's own demo style sets the bar

- Their launch demo is *"Flagsmith Experimentation Demo: Set Up a Full A/B Test in 5 Minutes"* — their Head of Product does the whole setup "in one seven-minute take": connect warehouse → create experiment on an existing flag → define rollout and metric → track events → read win probabilities (Flagsmith LinkedIn). **Implication for Track 02:** "an agent sets it up" must visibly beat or meaningfully differ from a competent human doing it in 5–7 minutes on video. An agent that merely replicates the dashboard flow at the same speed wins nothing.
- Their own marketing leads with the scorecard aesthetic: "99.6% winner probability and +14.2% lift for a checkout flow experiment" (Flagsmith promotional video, https://www.instagram.com/reel/Detz8obIQMG/). Their Bayesian A/B testing guide (https://www.flagsmith.com/blog/bayesian-a-b-testing) sells one idea: a direct answer — "how likely is it that variant B beats variant A" — plus a credible interval, checkable at any time.
- Their experimentation framework guide (https://www.flagsmith.com/blog/product-experimentation-framework) and product page (https://www.flagsmith.com/feature/experimentation-platform) repeat the discipline: **a good hypothesis names the change, the metric, the expected effect size, and the timeframe** ("offering PayPal at checkout will lift completed checkouts by at least 10% within 30 days"). An entry whose experiment has a vague hypothesis ("test the button") reads as amateur to anyone from this culture; an entry whose hypothesis is written in their format reads as fluent.
- Their customer story (Inflow, https://www.flagsmith.com/blog/inflow-a-b-testing-with-flagsmith-and-mixpanel) celebrates the scientific method and quotes verdicts as probabilities: "True wins with 92% probability."

### 2.3 Track 02 specifically: Flagsmith is selling the agent story itself

Flagsmith's own product copy lists *"MCP and CLI – Set up automated feature management workflows controlled by your AI agents"* and *"Connect your AI agents to manage tests autonomously"* (Flagsmith LinkedIn / SourceForge listing). Their *Playbook* (https://info.flagsmith.com/hubfs/eBooks/Feature%20Flags%20A%20Safety%20Net%20for%20AI%20Development.pdf) quantifies agent value as **toil time: 15 min → 1 min** for a flag task. So Track 02's "saves real time" criterion has a sponsor-published benchmark style: minutes before, minutes after.

But there is a trap, and it is the single most important Track 02 fact: **Flagsmith already gives away a free coding-agent prompt that does the naive version of this project** (https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent — "One prompt creates the flag, metric and experiment, and instruments your application"). Read what their prompt does, because TogglePilot is judged against it:

- It **asks the user questions first and waits** (what to test, what counts as success).
- It **verifies each step** and is told: *"If something fails, stop and show me the exact error; don't guess or work around it."*
- It offers the **simulated-traffic script** itself ("a few hundred users, each with its own identifier").
- It finishes with refreshed results and a link to the experiment.

Any Track 02 entry that is "a prompt that sets up an experiment" is a re-skin of a free official artefact and scores ~0 on Creativity. The gaps in the official prompt are exactly where a winning entry lives (see §5.3): it has **no approval gates** (Track 02 explicitly judges "a human approves changes"), **no pre-flight validation** of the silent-failure traps (it stops *after* errors; it does not check variant keys, warehouse state and event-name matching *before* creating anything), **no results narration or rollout step** (it ends at a link; it does not interpret win probability, recommend, and — on approval — roll the winner out with the same flag), and it is **a prompt, not a product** (no interface, no audit trail, no repeatability).

### 2.4 The 23 Nov webinar (21:30 IST, Flagsmith team, before hacking)

Nothing published states its agenda beyond "a live session with the Flagsmith team" (event page). Based on Flagsmith's launch content, expect: the 5-minute experimentation walkthrough, track expectations, and Q&A. Its real value is intelligence, not instruction: it is the one chance to hear, in the sponsor's own words, what they hope to see, and to ask the two questions that matter — what separates a winning Track 02 entry from the official prompt, and how judges will treat disclosed simulated traffic. Attend it as a research session; take notes into this file. (Pintu-only step: live attendance is his; Muse cannot hear meeting audio.)

---

## 3. Why Pintu's past entries did not win — the local evidence

Pintu has submitted 20+ hackathon entries without a win (his own count, given when setting the Kiroween win attempt). Only one entry produced a full scored breakdown, and it is the most valuable document in this analysis.

### 3.1 Signalpost (Builderr) — scored twice, failed the same way twice

- Oct 17 round: **50.00/100, rank 12 of 43, not qualified.** Recall **18.44/50**, Evidence **29.96/30**, Synthesis **0.00/12**, UX **1.60/8** (~/memory/2026-11-10.md).
- 13 Nov round: **47.52/100, tied rank 58 of 104, not qualified** (bar: 65). Recall **18.72/50**, Evidence **28.80/30**, Synthesis **0.00/12**, UX **0.00/8**. Accuracy 96% (~/memory/2026-11-14.md, ~/MEMORY.md).

Read the shape of that failure carefully:

- **Evidence near-perfect (28.8–30/30), accuracy 96%** — the engineering core was excellent and it did not matter.
- **Synthesis 0/12 in both rounds** — the part of the product that *presents, explains and packages the findings for a human* scored absolute zero, twice, even after a rescore cycle that fixed nine engineering defects. The v9 review's own estimate (~52–59/100) concluded the entry was "bound by discovery yield, not gates" — i.e. bound by how much verifiable output the system produced for judges to see (Recall 18.7/50; zero verified company news/jobs).
- In plain terms: **Pintu built the engine and lost on the scoreboard.** The judges could not see enough proved output, and the layer that turns output into a story scored nothing.

### 3.2 Qloo — TasteRoute vs Undertow (the lesson already on record)

Undertow won Qloo's $15,000 + $25,000 investment pledge by forecasting Senate races from taste data: **32 of 33 called correctly, vs 31 for polling alone**, including a specific flipped call (~/memory/2026-11-12.md). The lesson recorded at the time, verbatim: *"Undertow won on a measurable, verifiable claim with a scorecard, not on a better version of the obvious use."* TasteRoute was, by contrast, a competent version of the obvious use of the sponsor's API (taste-based recommendations). **Same failure shape as Signalpost: good build, no claim.**

### 3.3 The rest of the record

- **ReplyForge Hybrid** (#BuildHybridAI, submitted 14 Nov; judging 10–16 Dec): notably, this is the one entry where the measurable-claim discipline *was* applied — routing accuracy published as a band (27–28 of 30 across four runs, never the best run), offline honestly reported as 0 of 0 measured. Verdict still pending; it is the control case for whether the lesson works.
- **SpendGuard** (NEAR, submitted 14 Nov): a deterministic policy firewall between an AI agent and its wallet, 85/85 tests, three on-chain scenarios (one verified spend, two correct denials). A real, verifiable demonstration — results pending at the time of writing, no win recorded.
- **Triangulate** (Mozilla Otari, submitted 11 Nov): three models answer independently, a synthesis call cross-examines them into Consensus / Contested / Single-source. Under review; no outcome yet. Conceptually the strongest "not the obvious use" entry of the set — the sponsor's gateway is the mechanism, not a pipe.
- **DeskReset** (VibeX Codes 26, submitted 15 Nov): a 60-second on-device posture check producing a **Posture Score /100** — a scorecard-shaped product. Results due 19 Nov 20:50 IST, pending at the time of writing.
- **The pattern in what advanced:** FinTech 2026 shortlisted Pintu for expert-jury evaluation (idea stage), and Prasunex qualified him to Round 3 on a **design document**. His entries advance when judged on a clear, well-packaged document — and stall when judged on a live product's visible completeness (Signalpost). Packaging is not his weakness in documents; it is his weakness *in products and demos*.

### 3.4 The recurring failure patterns (honest list)

1. **Building the obvious use of the sponsor's product.** TasteRoute for Qloo; the first version of most entries. Winners take the sponsor's capability somewhere the sponsor's own homepage does not already show.
2. **No measurable claim.** No number a judge can verify, repeat, or compare. Signalpost had the numbers internally (96% accuracy) but the *scoreboard the judges scored* — verified items found — was near-empty where it counted (Recall 18.7/50, zero verified news/jobs).
3. **Synthesis/presentation scored zero — literally.** 0/12 and 0/8 are not "weak presentation"; they are an absent layer. The demo and README were treated as packaging after the build, not as scored components designed from the start.
4. **Scope spread across many features, completeness judged on coverage.** Signalpost's recall ceiling was a coverage problem; multi-feature entries give judges more surfaces to find unfinished.
5. **Speed-first sequencing.** Build first, understand judging later — the exact habit Pintu named in this tasking. Every scored failure above was discovered *after* submission.
6. **What is NOT a pattern:** engineering quality. Evidence 28.8/30, 96% accuracy, 85/85 tests, 322 passing tests in the rescore build. The builds are good. The losses are in claim, coverage-of-what-judges-score, and presentation. That is fixable in one event — if the fix is designed in before the build, which is the entire point of this document.

---

## 4. Win conditions for Toggle Wars (checkable)

Derived from §1–§3 and the published scorecard — four criteria for every track: **Use of Flagsmith · Impact · Creativity · Demo video** (event page; WeMakeDevs scorecard post, https://www.instagram.com/p/Dfv_3KpAbU1/). Each condition below is phrased so it can be ticked off before submission.

### 4.1 Universal win conditions (any track)

- [ ] **One-sentence pitch** that names a user, a pain, and the mechanism — repeatable by a judge after one hearing (§1.6.1).
- [ ] **Flagsmith is load-bearing:** deleting Flagsmith deletes the project. The experiment/flag does real work in the core loop, not in a settings page (§1.2, §1.5).
- [ ] **One measurable claim, proved live, shown as a scorecard** in the first screen of the README and the last 30 seconds of the video. Numbers from the real run, on the real Flagsmith system (§1.3, §3.2).
- [ ] **A decision happens on screen:** data picks a winner and the winner is shipped with the same flag — Kunal's "a step past 'it works'" (§2.1).
- [ ] **Hypothesis in Flagsmith's own format:** change + metric + expected effect + timeframe (§2.2).
- [ ] **Scope: one workflow, finished.** Every button in the demo works; nothing shown is a mock of a feature that does not exist (§1.6.4, §3.4.4).
- [ ] **Disclosed seams:** simulated traffic labelled simulated, estimates labelled estimates, in README and video narration (§1.3, Switch Gear).
- [ ] **Pre-submission review against the bar** (Pintu's standing rule): projected score per criterion, written down, before submitting — not after (§3.4.5).

### 4.2 What the winning Track 01 entry probably looks like

A small, real app (landing page, onboarding flow, or pricing page) with one bold, genuinely uncertain question; a multivariate flag serving visibly different variants; a high-baseline metric (clicks/completions at 20–40%, not 2% purchases — see `research.md` §4.4); ≥50 identities and ≥5 conversions per arm cleared early; a results page the video can linger on (win probability, lift, credible interval, no SRM warning); the winner rolled out with the same flag on camera; and an honest explanation of the result *whichever way it lands*. Its claim is the result itself: "Variant B lifted signup completion from 24% to 31% (96% chance to beat control) — and here is the rollout."

### 4.3 What the winning Track 02 entry probably looks like

A tool a judge can imagine using on Monday morning. It drives the **CLI/API** (MCP alone cannot start experiments — Flagsmith's own guide says so, `research.md` §2.4); it shows a **plan before it acts**; a **human approves, edits, or rejects** — visibly, including one edit; it **saves a measured amount of time** against the manual baseline Flagsmith itself demos (the 5–7 minute dashboard flow); its output is a **plain-English readout** a non-expert can act on; and its demo contains a **complete experiment lifecycle**, ending in a rollout decision — borrowing Track 01's climax without entering Track 01.

### 4.4 Demo-video formula (target ≈ 3 minutes)

Judged as its own criterion; built from the winner write-ups' structures:

1. **0:00–0:25 — The problem, with a number.** The manual workflow on screen, timed: "Setting up one experiment in the dashboard takes ~25 minutes across four surfaces — and it fails silently in five known ways." (Use the real measured number from §5.3's scorecard work, not this estimate.)
2. **0:25–0:40 — The pitch.** One sentence, on screen as text.
3. **0:40–1:30 — The product working.** The core action, live, against the real Flagsmith project — real API responses, real dashboard changing. No slides where a screen recording exists.
4. **1:30–2:10 — The human in control.** The plan is reviewed; one value is *changed* by the human; approval given. (Track 02's judging line, shown, not said.)
5. **2:10–2:45 — The result.** The experiment's results page: identities, conversions, win probability. Then the decision: winner approved and rolled out with the same flag.
6. **2:45–3:00 — The scorecard end card.** The entry's claim in numbers (§5.3) + what is simulated, labelled in one line.

Rules: narrate claims only where the screen proves them; every number spoken appears on screen; no feature is mentioned that is not shown working.

### 4.5 README formula

In order, first screen first: **one-line pitch → the scorecard table (the claim, with numbers) → live demo link + video link → what it does (the one workflow) → how Flagsmith is used (flag, metric, experiment, API calls — including the MCP-can't-start-experiments callout for Track 02) → architecture (one diagram) → run it yourself (≤10 minutes, free tier) → honesty box (what is simulated, what is estimated, AI tools used) → what is next.** A judge who reads nothing else should still be able to score all four criteria from the README alone — Signalpost's Synthesis 0/12 is what happens when they cannot (§3.1).

---

## 5. TogglePilot, re-scored

TogglePilot (`research.md` §4.2, Concept A): a prompt-to-experiment agent — describe a test in plain words; it checks the warehouse, drafts a full experiment plan, takes human approval, creates flag/metric/experiment via CLI + REST, generates the SDK instrumentation, starts on a second approval, and later narrates results in plain English.

### 5.1 Against the win conditions

| Win condition | Verdict | Evidence |
|---|---|---|
| One-sentence pitch | **Pass** | "Describe an A/B test in one sentence; TogglePilot sets it up, gets your approval, launches it, and tells you the winner in plain English." |
| Flagsmith load-bearing | **Pass** | Its entire job is the experimentation lifecycle; remove Flagsmith and nothing remains. |
| Not the obvious use / beats the free prompt | **Partial — at risk** | The concept *as sketched* is the official prompt, productised. The differentiators (approval gates, MCP workaround) are real but were framed as features, not as the headline. §2.3: parity with a free artefact scores ~0 on Creativity. |
| Measurable claim with scorecard | **Fail as sketched** | "Saves time" was asserted (~20–30 min manual estimate), never measured, and no scorecard was designed. This is exactly failure pattern §3.4.2 — the Signalpost/Qloo failure, repeated. |
| Decision on screen / lifecycle climax | **Partial** | Results narration was in scope; rollout of the winner was not an explicit, designed climax. Without it the demo ends at "here is a link" — where the official prompt ends too. |
| Human approves changes | **Pass** | Two approval gates were already the design's spine — and it is a named Track 02 judging line. Needs one *edit* shown, not just approvals (§4.4.4). |
| Scope fits 26–29 Nov solo | **Partial — trim needed** | Plan → create → instrument → start → narrate → (new) roll out is the full lifecycle; a monitoring dashboard or multi-stack snippets would break the window. One stack (React), one host app, CLI-first interface. |
| Presentation designed in | **Fail as sketched** | The concept said nothing about the video or README as scored artefacts. §3.4.3: this is the layer that scored 0/12 and 0/8 last time. |

### 5.2 Verdict: **KEEP — with three mandatory changes**

Replacement was considered and rejected: no alternative concept scores better on the deterministic Track 02 criteria *and* Pintu's strengths, and the concept's weaknesses are all in claim/presentation/scope — the fixable layer — not in the core idea. But TogglePilot as sketched in `research.md` would have repeated the historical failure precisely: a good build, an asserted benefit, no proved claim. The changes below are not enhancements; they are the entry.

### 5.3 The three mandatory changes

**Change 1 — Build the scorecard first; it is the product's reason to exist.**
Before any agent code, measure the manual baseline for real: time a competent manual setup of the same experiment (warehouse check → flag + variants → metric → experiment → instrumentation) in the Flagsmith dashboard, counting minutes, screens visited, and errors made. Then TogglePilot's claim is measured against it, Tryouts-style, and printed as a table:

| | Manual (dashboard) | TogglePilot |
|---|---|---|
| Wall-clock time | *measured* | *measured* |
| Surfaces/screens touched | *counted* | 1 (the plan) |
| Silent-failure traps checked | 0 (human memory) | 5 of 5, automatically |
| Approvals before anything mutates | n/a | 2 (plan, start) |

Flagsmith's own Playbook frames agent value exactly this way (toil 15 min → 1 min, §2.3). If TogglePilot cannot beat the manual baseline on camera, the entry has no claim and should not be submitted in this shape — that decision is made on 26 Nov from measurements, not on 29 Nov from hope.

**Change 2 — The demo's climax is a completed experiment with the winner rolled out.**
TogglePilot must ship with one small host app (a single landing page with one flag and one metric — e.g. two headline/CTA variants, `cta_clicked` occurrence) on which it runs a *real* experiment end to end during the window: plan → approve → create → instrument → start → disclosed seeded cohort (a few hundred identities through the real pipeline, per Flagsmith's own sanctioned simulator pattern, `research.md` §4.4) plus any real traffic the live link gathers → results refreshed → plain-English verdict → human approves → **winner rolled out with the same flag, live**. The results page (win probability, lift, credible interval, no SRM warning) is the video's money shot. This imports Track 01's "results you can explain" into a Track 02 entry — the hedge `research.md` recommended, now made structural rather than optional.

**Change 3 — Add the pre-flight validator, and make it the headline differentiator.**
Before creating anything, TogglePilot checks — and reports in plain English — the five silent killers from the docs (`research.md` §1.2): (1) warehouse connected for the environment; (2) every variant has a key/label; (3) metric event name exactly matches the app's event (case-sensitive); (4) SDK versions at or above the event-capable minimums (`@flagsmith/flagsmith` 12.4.0+, `@flagsmith/nodejs` 9.1.0+); (5) identities + `flushEvents()` present in the instrumentation. The official prompt *stops when something fails*; TogglePilot *catches it before it fails*. In the demo, one trap is deliberately planted (an unlabelled variant) and caught on camera. This is the "Synthesis" layer Signalpost never had — the product explaining itself — and it is the clearest distance from the free prompt.

**Scope lock (what is NOT built):** no web dashboard (CLI + a clean plan/results printout is the interface); snippets for React only; no persistent monitoring (results readout is one command); no multi-project support. Estimated build: agent + validator ≈ 40% of the window, host app + simulator ≈ 20%, scorecard measurement + video + README ≈ 40% — the presentation share is deliberate, set by §3.1's zeroes.

### 5.4 If the measurements fail (the honest fallback)

If on 26–27 Nov the timed baseline shows the agent is *not* clearly faster/cleaner than the dashboard (plausible — Flagsmith's own demo is 5–7 minutes), the claim pivots from speed to **safety**: "TogglePilot catches the five silent failures that make experiments report zero — the dashboard catches none of them before launch," proved by planting each trap and catching it. That claim needs no traffic and no stopwatch luck, and it is arguably the more Flagsmith-fluent story. Decide from the 26 Nov measurements; do not carry both claims — one claim, proved, is the whole lesson of §3.

---

## 6. Risks — what could disqualify or sink the entry

1. **Simulated-traffic honesty (the disqualification-shaped risk).** Track 01 judging demands "a metric from real events"; Toggle Wars' own materials do not define "real", and Flagsmith's official guide itself prescribes the simulator script (`research.md` §4.4). The safe line, held everywhere (README, video narration, any judge Q&A): the *pipeline* is 100% real (real identities, exposures, warehouse, Bayesian engine); the *cohort* is seeded and **labelled seeded, with its size and conversion rates stated**. Never call seeded users organic, never quote a win probability without the cohort disclosure beside it, and never tune the simulator's rates mid-run to manufacture a winner — SRM checks and quarantined identities exist precisely to expose rigged splits (`research.md` §1.3), and a "too good" result invites exactly the scrutiny that kills credibility. Switch Gear's disclosure (§1.3) is the model: state the seams early, in writing.
2. **Pre-existing code.** The event page states **no rule** either way (`research.md` §3) — no "all code written during the window" clause. Posture: prep before 26 Nov is legitimate and organiser-sanctioned in kind (accounts, warehouse connection, specs, this research, the official prompt itself is handed out in advance); the substantive build happens inside the window; do not submit a re-badged prior project. If asked, the honest answer is: designed before, built 26–29 Nov.
3. **AI-use disclosure.** The event explicitly allows AI coding tools — *"You still need to understand and explain what you built"* (event FAQ). Two consequences: (a) disclose AI assistance in the README (it is expected, not penalised); (b) Pintu must be able to explain every part of TogglePilot unaided — keep the architecture simple enough that this is true, and write the README so it doubles as his briefing.
4. **Deadline discrepancy.** The event page says submissions close **20:00 IST, 29 Nov**; a WeMakeDevs Instagram scorecard post says **11:59 PM IST, 29 Nov**. Plan to the earlier time; treat anything after 20:00 as grace, not schedule.
5. **Beta-product risk.** Experimentation is beta: results refresh at most once per 5 minutes, and the first warehouse event "can take up to a few hours" to process (`research.md` §1.1, §1.4). Mitigation is scheduling, not code: connect the warehouse and fire the first test events at **08:00 on 26 Nov, before building anything**, and run the demo experiment early enough that its results exist by 28 Nov. A demo whose results page says "Collecting data" on submission day is Signalpost's recall failure in a new costume.
6. **Free-tier ceilings.** 50,000 API requests/month on Flagsmith Cloud Free; a chatty simulator can eat this. Budget the cohort size (a few hundred identities is enough to clear the floors and reach a readable verdict with a bold variant effect) and count requests during rehearsal runs.
7. **Track exclusivity and the AirPods footnote.** One project wins in one track; the Track 01-flavoured demo inside a Track 02 entry earns no Track 01 prize — accepted deliberately (§5.2). Separately: star Flagsmith on GitHub for the AirPods draw — free, and unrelated to judging.
8. **Judges skim.** 1,000+ registrations, community-recruited judges (§2.1). Any win condition that only becomes visible after minute two of the video or page two of the README should be treated as absent. This is a risk to manage in the edit, not the build.

---

## 7. The plan this implies (26–29 Nov, solo)

- **Before the window:** attend the 23 Nov webinar as research (§2.4); create the Flagsmith account/project; write the spec from `research.md` + this file; script the video before building (the video's shot list *is* the feature list — §3.4.3's correction).
- **26 Nov, first hour:** connect the managed warehouse; fire test events; start the clock on warehouse processing. Then measure the manual baseline (Change 1) and lock the claim (speed or safety, §5.4).
- **26–27 Nov:** build TogglePilot (validator → planner → approval → CLI/REST creation → React snippet → start gate → results narrator → rollout-on-approval). Host app + simulator alongside.
- **27–28 Nov:** run the real experiment; gather the scorecard numbers; rehearse the full demo path end to end.
- **28–29 Nov:** README per §4.5; video per §4.4; pre-submission review with projected scores per criterion (Pintu's standing rule); submit by 29 Nov 20:00 IST.

---

## Sources

**WeMakeDevs winners and event signals**
- WeMakeDevs Telegram (No Hands, Graph Hacks, Agent Harness winner announcements) — https://t.me/s/WeMakeDevs
- Toggle Wars scorecard post (four criteria; note the 11:59 PM deadline variant) — https://www.instagram.com/p/Dfv_3KpAbU1/
- Judge recruitment ("experienced voices from the developer ecosystem") — https://twstalker.com/WeMakeDevs
- Kunal Kushwaha on Toggle Wars ("a step past 'it works'") — https://twstalker.com/kunalstwt
- Tryouts (Flip the Switch; the scoreboard write-up) — https://www.aryankumar.dev/blogs/tryouts-ai-coder-hiring-switch
- Switch Studio (Flip the Switch; "who is this for, and how do you know it works?") — https://medium.com/@vivek.neuralvibe/how-do-you-stop-an-ai-agent-from-publishing-claims-your-repo-cannot-support-ddd6d11e99d4
- Switch Gear (Flip the Switch; disclosed simulation) — https://dev.to/adybose/i-let-ai-agents-build-and-run-my-t-shirt-store-from-slack-in-just-24-hours-58k2
- Teesri Shikayat / Rote Playoffs (Aryan Gorde, portfolio) — https://www.aryangorde.com/
- Hero Goggles (Patch the Conference; "taking it out would break something") — https://docs.infrared.darkshift.io/blog/hero-goggles-at-the-cloud-native-hackathon/

**Flagsmith's own signals**
- Event page (rules, tracks, judging, FAQ) — https://www.wemakedevs.org/hackathons/flagsmith
- Set up an experiment with a coding agent (the official prompt — the Track 02 baseline to beat) — https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent
- Experimentation docs — https://docs.flagsmith.com/experimentation
- Bayesian A/B testing guide — https://www.flagsmith.com/blog/bayesian-a-b-testing
- Experimentation product page (hypothesis format) — https://www.flagsmith.com/feature/experimentation-platform
- Product experimentation framework — https://www.flagsmith.com/blog/product-experimentation-framework
- Inflow case study (verdicts as probabilities) — https://www.flagsmith.com/blog/inflow-a-b-testing-with-flagsmith-and-mixpanel
- Flagsmith Playbook (toil time 15 min → 1 min) — https://info.flagsmith.com/hubfs/eBooks/Feature%20Flags%20A%20Safety%20Net%20for%20AI%20Development.pdf
- Flagsmith LinkedIn (Toggle Wars partnership; the 5-minute demo; "manage tests autonomously") — https://uk.linkedin.com/company/flagsmith
- Flagsmith promotional video (99.6% win probability / +14.2% lift framing) — https://www.instagram.com/reel/Detz8obIQMG/

**Pintu's own record (local)**
- Signalpost, Oct 17 round: 50.00/100, Recall 18.44/50, Evidence 29.96/30, Synthesis 0/12, UX 1.60/8 — ~/memory/2026-11-10.md
- Signalpost, 13 Nov round: 47.52/100, Recall 18.72/50, Evidence 28.80/30, Synthesis 0/12, UX 0/8; v9 review "bound by discovery yield" — ~/memory/2026-11-14.md, ~/MEMORY.md
- Qloo result and the recorded lesson (Undertow's scorecard) — ~/memory/2026-11-12.md
- Mechanics, rules, SDK traps, TogglePilot concept — ~/workspace/flagsmith-toggle-wars/research.md
