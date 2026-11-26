# Toggle Wars: The Flagsmith Experimentation Hackathon — Research

**For:** Pintu Kumar (solo, Full Stack Developer — React, TypeScript, Node.js, strong AI-agent experience)
**Event:** WeMakeDevs × Flagsmith, online, hacking **26 Nov 2026 08:00 IST – 29 Nov 2026 20:00 IST**
**Researched:** 19 Nov 2026, from official Flagsmith docs (docs.flagsmith.com), flagsmith.com, and the live event page.
**Bottom line up front:** Recommend **Track 02 (AI Agents and Feature Flags, $1,000)** as the primary entry, with a Track 01-style live experiment built *into* the Track 02 demo. Track 01 pays double ($2,000) but its judging hinges on results from real events, and Flagsmith withholds results until each arm has ≥50 identities and ≥5 conversions — a traffic problem a solo builder has ~84 hours to solve credibly. Track 02 is judged on CLI/API/MCP use, time saved, human approval, and clear output — all deterministic, all squarely in Pintu's agent-building strength, and none of it depends on acquiring users.

---

## 1. Flagsmith Experimentation — how it actually works

Experimentation is **in beta**. In Flagsmith's own words:

> "Flagsmith Experimentation lets you run A/B tests end to end on the platform: serve variations of a feature with a multivariate flag, collect events from your application into a data warehouse (the managed Flagsmith warehouse, or your own), and read the results with a built-in Bayesian statistics engine."
> — https://docs.flagsmith.com/experimentation

Experiments are **scoped to an environment** (one flag can only be in one active experiment at a time).

### 1.1 The five setup steps (in order — each is a hard prerequisite for the next)

1. **Connect a warehouse** (once per environment). Experiment data (exposures + conversion events) is stored and queried in a warehouse; the connection "must be in place before you can create experiments", and the event ingestion service **rejects events for environments without one**. Options:
   - **Managed Flagsmith warehouse** — zero-config, enable in Environment Settings › Warehouse. Available on Flagsmith Cloud only.
   - **Bring your own** — ClickHouse, Databricks, or PostgreSQL/Postgres-compatible. On Flagsmith Cloud, BYOW requires a **Scale-Up or Enterprise** subscription. Snowflake and BigQuery are "coming soon".
   - **Self-hosted** — no plan restriction; you must use your own warehouse. The Docker Compose setup offers the **"Flagsmith database"** option: the API receives SDK events at `http://localhost:8000/api/v1/events/` and stores them in its own PostgreSQL. Docs warn this "is only meant for trying out experimentation. For production, connect a dedicated warehouse such as ClickHouse or Databricks."
   - First-event processing "can take up to a few hours" — **do the warehouse step on day 1, not during the demo**.
   Sources: https://docs.flagsmith.com/experimentation/connect-a-warehouse · https://docs.flagsmith.com/deployment-self-hosting/hosting-guides/docker

2. **Create a multivariate flag.** A multivariate (A/B/n) flag holds the variants with percentage weightings:
   - Percentages must sum to 100%, at least two variants.
   - The flag's own current value is the **control** (the key `control` is reserved).
   - Bucketing is **deterministic per identity per environment**: the same identity always gets the same variant; changing weights mid-test re-buckets users and can invalidate results.
   - **Every variation needs a label/key.** "Exposures are attributed by label, so a variation without one, for example one created through the API without a `key`, is not counted." This is the single easiest way to silently get zero results.
   - Unauthenticated traffic is fine: generate a persistent anonymous GUID/UUID (cookie/localStorage) and identify with it.
   Source: https://docs.flagsmith.com/managing-flags/core-management

3. **Create metrics.** A metric is defined per environment (reusable across experiments) from the events your app sends:
   - **Aggregation types:** *Occurrence* (event seen at least once per identity — e.g. signup completion), *Count* (number of events), *Sum* (total of numeric `value` — e.g. revenue), *Mean* (average numeric value — e.g. average order value). Sum/Mean require the app to send `value` with each event.
   - **Direction:** higher is better / lower is better / informational — becomes the experiment's expected direction (goal vs guardrail).
   - **Event name must exactly match** what the application sends, case-sensitive; unmatched events are "silently ignored".
   Source: https://docs.flagsmith.com/experimentation/create-metrics

4. **Create the experiment** (4-step wizard):
   - *Setup:* name + hypothesis + flag. Docs' example of a good hypothesis: *"Redesigning the checkout button with a clearer CTA will increase conversion rates by at least 15% within 30 days."*
   - *Rollout configuration:* **Rollout** = % of identities that enter the experiment at all (the rest keep normal flag behaviour and are not counted); **Variation split** = how enrolled identities divide across control and variations (weights sum to 100, control takes the remainder). Example from the docs: 20% rollout + 50/50 split = 10% control, 10% variation, 80% untouched.
   - *Measurement:* pick the **primary metric** and expected direction.
   - *Review & Launch:* "The experiment starts immediately."
   - **While running, the flag configuration and variations are locked.** Rollout % can still be edited, but changing it mid-experiment "can affect the statistical validity of your results". Ending an experiment freezes results permanently; it cannot be restarted.
   Source: https://docs.flagsmith.com/experimentation/create-an-experiment

5. **Run it — instrument the app.** This is where most hackathon entries will quietly fail. See §1.2.

### 1.2 What the app must wire up end-to-end for results to register

From https://docs.flagsmith.com/experimentation/run-an-experiment :

- **Remote evaluation only.** "Experiments currently work with remote evaluation only. Support for local evaluation is in progress." (This kills the Node SDK's local-evaluation mode for experiment traffic — see §2.)
- **Identities are mandatory.** "Users must be identified. Exposures and conversion events are joined per identity, so use the same identifier for flags and events." Exposures without an identity are skipped.
- **Minimum SDK versions for event collection** (older packages silently can't send events):
  - JavaScript / React: `@flagsmith/flagsmith` **12.4.0+**
  - Node.js: `@flagsmith/nodejs` **9.1.0+** — "the older `flagsmith-nodejs` package can't"
  - (Also Python 6.3.0+, Java 8.2.0+, Go v5.3.0+, Flutter 6.2.0+)
- **Enable events at init:** `enableEvents: true` with the environment key (client-side or server-side keys both accepted). Self-hosted also needs `api` and the events/ingestion URL pointed at the local instance (`http://localhost:8000/api/` — "the local instance receives events itself").
- **Record exposures at the point of experience:**
  ```js
  const flag = flagsmith.getExperimentFlag('checkout_button'); // evaluates + records $flag_exposure in one call
  // render based on flag.value / flag.variant
  ```
  `getExperimentFlag` records a `$flag_exposure` event with the served variant, only when the flag exists, is enabled, and the identity is enrolled. If you evaluate in one place and render in another, evaluate with the normal call (records nothing) and call `flagsmith.trackExposureEvent('checkout_button', { value: flag.variant })` at the display point, guarded by `flag.experiment.inExperiment`. Exposures are deduplicated per identity (counted once, in the variation seen first), so double-recording is safe.
- **Track conversions where success happens:**
  ```js
  flagsmith.trackEvent('purchase', { value: 99.5 });
  ```
  Event name is case-sensitive and must match the metric. "Conversions are attributed post-exposure: an identity's events only count after its first exposure."
- **Flush before exit.** SDKs buffer events and batch every ~10 seconds. Scripts and serverless/SSR paths must `await flagsmith.flushEvents()` before responding/exiting, or the data never arrives.
- **Rejection windows:** events older than 10 days or >24h in the future are rejected; a batch over 2 MiB is rejected whole. Events are delivered at least once, so Count/Sum/Mean can very slightly double-count on retries (Occurrence and exposures are immune).
- **Debugging:** the SDKs "skip events silently rather than throw" — if the Exposures panel stays empty, check, in the docs' order: warehouse connected → user identified → every variation has a label → identity inside the rollout → events flushed → event names match exactly.

### 1.3 How win probability is calculated and shown

The engine is **Bayesian** (deliberately not p-values: "peeking doesn't inflate your error rate the way repeated p-value checks do", so results can be checked any time).

Results page (https://docs.flagsmith.com/experimentation/analyse-an-experiment · https://docs.flagsmith.com/experimentation/statistics):

- Computed **on demand** — click *Refresh results*, at most once every 5 minutes; an "As of" timestamp shows freshness.
- Scorecards: **Users enrolled**, current **Winning variation**, its **Chance to be best**, and **Lift vs control**.
- Per-variation table: **Exposures**, metric value (rate/count/sum/mean), **Delta** (% vs control), **95% Credible Interval** (the range the true delta sits in with 95% certainty — if it crosses zero, inconclusive), and **Win Probability** ("Chance to beat control").
- Verdict thresholds: **>95% chance to beat control = Winning** (a banner then recommends rolling out the winner); **<5% = Losing**; in between = Inconclusive. Rollout of the winner is done by updating the same flag so everyone gets the winning variation, then ending the experiment and cleaning up losing variants.
- **Collecting-data floor:** a variation shows "Collecting data" (numbers withheld) until it has **≥50 identities** — and for occurrence/conversion metrics, **≥5 conversions**. This is the hard minimum any demo must clear per arm.
- **Sample Ratio Mismatch (SRM):** if the observed split deviates from the configured split at a one-in-a-thousand rarity level (checked once ≥100 identities), a warning fires: "Don't act on the results." Identities recorded against more than one variant are **quarantined/excluded** and shown separately.

### 1.4 Plans: free cloud vs paid vs self-hosted

- **Experimentation is available on all Flagsmith SaaS plans**, including Free, using the managed warehouse; pricing is based on **monthly tracked users in experiments (MTUE)**. BYOW is Scale-Up/Enterprise only (see §1.1).
  — https://www.flagsmith.com/feature/experimentation-platform
- **Free (Cloud) — $0:** 50,000 API requests/month, **100,000 users in experiments**, 1 team member, unlimited flags, environments, identities and segments, API access. Start-Up ($40/mo annual / $45 monthly): 1M requests, 500,000 experiment users, 3 team members. Scale-Up ($250/mo annual / $300 monthly): 5M+ requests, 2M+ experiment users, BYOW, SAML/SSO, governance.
  — https://www.flagsmith.com/compare/flagsmith-vs-launchdarkly (Flagsmith's own pricing summary; figures cross-checked against https://www.flagsmith.com/pricing summaries in third-party comparisons read 13 Nov 2026)
- A solo hackathon entry fits comfortably inside Free: 50k requests is the binding constraint, and a client-side SPA makes roughly one request per user session.
- **Self-hosted (open source, BSD-3-Clause core):** free, no request/user caps — but *you* run the whole stack (Docker Compose: API + frontend + PostgreSQL), experimentation needs the Flagsmith-database warehouse (trial-grade) or your own ClickHouse/Databricks/PostgreSQL, plus an event ingestion path. Heavier ops for a 3.5-day window; only worth it for Track 03, which requires it.
- **Beta risk:** Experimentation is beta, results refresh is manual (≤1 per 5 min), first warehouse event can take "up to a few hours" to process. Build slack into the schedule.

---

## 2. SDKs and APIs for a React + Node.js stack

### 2.1 Client side: `@flagsmith/flagsmith` (JavaScript / TypeScript)

One package serves vanilla JS, React, and React Native; full TypeScript support.
— https://docs.flagsmith.com/integrating-with-flagsmith/sdks/client-side-sdks/javascript

```bash
npm i @flagsmith/flagsmith
```

- Initialised against a single environment with the **client-side environment key**: `flagsmith.init({ environmentID, onChange, cacheFlags, enableAnalytics, defaultFlags, ... })`. `init` returns a promise (cache/defaults first, then server). Supports `defaultFlags` and an offline handler (generate `flagsmith.json` in CI with the legacy CLI) so the app renders sensibly if the API is unreachable.
- Core calls: `hasFeature(key)`, `getValue(key)` (this is what returns the multivariate variant value), `getAllFlags()`, `identify(userId, traits)`, `setTrait(s)`, `logout()`. Flags are fetched **remotely** — client-side SDKs are remote-evaluation only, evaluating against the Flagsmith API/Edge API per identity.
- **Experimentation (12.4.0+):** add `enableEvents: true` at init; use `getExperimentFlag(key)` / `trackExposureEvent(...)` / `trackEvent(name, { value })` / `flushEvents()` as in §1.2.

### 2.2 React integration: `@flagsmith/flagsmith/react`

— https://docs.flagsmith.com/integrating-with-flagsmith/sdks/client-side-sdks/react · https://docs.flagsmith.com/integrating-with-flagsmith/sdks/client-side-sdks/nextjs-and-ssr

- Wrap the app: `<FlagsmithProvider flagsmith={flagsmith} options={{ environmentID }}>` (from `@flagsmith/flagsmith/react`).
- `useFlags(['flag_a'], ['trait'])` — subscribes a component to specific flags/traits and re-renders only when those change.
- `useFlagsmith()` — access the instance (identify, trackEvent, etc.); `useFlagsmithLoading()` for loading state.
- **`useExperiment`** — the React hook referenced in the official coding-agent guide: "Identify the user, then get the experiment flag (for example `getExperimentFlag`, or `useExperiment` in React) where the user actually sees the variation, and render by its value." It resolves the flag and records the exposure in one step (also confirmed on the experimentation product page: "React apps can use the useExperiment hook, which resolves the flag and records the exposure in one step").
- **Next.js / SSR:** use the isomorphic build (`@flagsmith/flagsmith/isomorphic`, `createFlagsmithInstance`), fetch flags on the server, pass state down with `flagsmith.getState()` → `<FlagsmithProvider serverState={...}>`, hydrate on the client with `setState`. There's also `@flagsmith/flagsmith/next-middleware` for middleware evaluation. Remember to flush events before the server render responds.

### 2.3 Server side: `@flagsmith/nodejs`

— https://docs.flagsmith.com/integrating-with-flagsmith/sdks (SDKs overview) · version requirement per https://docs.flagsmith.com/experimentation/run-an-experiment

- Current package is **`@flagsmith/nodejs` (9.1.0+ required for experiment events)**. The legacy `flagsmith-nodejs` package cannot send events — using it for an experiment is a silent-failure trap.
- Uses a **server-side environment key** (secret; `ser.`-prefixed for local evaluation). Config uses `environmentKey` (the old `environmentID` is no longer supported in current wrappers).
- Two evaluation modes (server SDKs generally):
  - **Remote evaluation (default):** every evaluation is a call to the Flagsmith API, which returns flags evaluated for that identity. Required for serverless, and **required for Experimentation** (experiments are remote-only today).
  - **Local evaluation (opt-in, `enableLocalEvaluation: true`):** the SDK downloads the full environment document (flags, segments, overrides) and polls for updates (default every 60s), evaluating in-process with the bundled flag engine — fast and network-independent, but needs the server-side key, does not persist traits, and **cannot be used for experiment exposures/conversions yet**.
- Client-side SDKs cannot do local evaluation at all; server SDKs in remote mode do not cache flags locally (each evaluation is a network request) unless local mode is on.
- Practical shape for Pintu: React SPA (or Next.js) with `@flagsmith/flagsmith` for the experiment surface + a thin Node/Express service using `@flagsmith/nodejs` in remote mode for server-side conversions (e.g. a completed signup/purchase confirmed by the backend) — both identifying with the same identity ID.

### 2.4 Managing Flagsmith programmatically — REST API, CLI, MCP (the Track 02 surface)

**Yes — there is a full REST Management API.** "The Management API allows you to programmatically manage your Flagsmith projects, environments, features, segments, and users. Essentially, any action you can perform in the Flagsmith dashboard can also be accomplished via the Management API." Auth is an API key (or user token); requests act with that key's permissions — no admin required. Swagger/OpenAPI explorer at `https://api.flagsmith.com/api/v1/docs/`; rate limits apply.
— https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/management-api

Experiment-specific endpoints (from the official coding-agent setup guide, https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent):

- Create metric: `POST api/v1/environments/<environment key>/experiment-metrics/` with the metric name, aggregation and event name.
- Create experiment: `POST api/v1/environments/<environment key>/experiments/` with the flag ID, name/hypothesis, primary metric, rollout, and `multivariate_feature_state_values` giving each variation its `percentage_allocation` (control gets the rest).
- Start it: `POST api/v1/environments/<environment key>/experiments/<id>/start/` — "starting locks the flag and turns on the rollout".
- Check warehouse first: `GET api/v1/environments/<environment key>/warehouse-connections/` — no warehouse, no experiments.
- There are also newer experimental flag-update endpoints (`GET/PATCH/PUT https://api.flagsmith.com/api/__future__/environments/{environment_key}/features/{feature_id}/`) that can read a flag's full served state and re-weight multivariate variants — flagged experimental, may change without notice, and don't work when change requests are enabled.
  — https://docs.flagsmith.com/managing-flags/updating-flags

**Flagsmith CLI (v2+)** — install via `curl -fsSL https://get.flagsmith.com | sh` (or Homebrew; `npm install -g @flagsmith/cli` only as fallback). Auth: `flagsmith login` on Cloud, or an organisation API key / `flagsmith.env` file for self-hosted. It wraps the Management API (`flagsmith api <path>` passes arbitrary API calls through, `--input -` reads a JSON body from stdin) and has first-class experiment-setup commands:

```bash
flagsmith feature create <flag> --value control --enabled
flagsmith feature variant add <flag> --value <value> --key <key> --weight 0
flagsmith feature get <flag> --json
```

(Note: the *legacy* `@flagsmith/cli` referenced in the JS SDK docs for offline flag snapshots is a different, older tool — don't confuse them.)

**MCP server** — Flagsmith ships an official MCP server giving AI agents access to the Management API via the Model Context Protocol: hosted on SaaS at `https://mcp.flagsmith.com`, or self-hosted as a Docker container (`flagsmith/flagsmith-mcp`, Streamable HTTP at `/mcp`), or run locally over stdio via `uvx` with a static API token. Clients authenticate as themselves and inherit their own permissions.
— https://docs.flagsmith.com/deployment-self-hosting/mcp-server

> **Critical Track 02 caveat, straight from Flagsmith's own coding-agent guide:** "Don't use the Flagsmith MCP server: it can't start experiments." An agent that *creates and launches* experiments must drive the **CLI and/or the REST Management API**; the MCP server is fine for reading/managing flags but is not sufficient alone. A Track 02 entry that discovers and works around this — MCP/CLI for setup and reads, REST API for metric/experiment creation and start, with a human approval gate before `start/` — is demonstrating exactly the expertise the track judges list.

**The official one-prompt path:** Flagsmith publishes a ready-made prompt for Claude Code / coding agents that "creates the flag, the metric and the experiment, and adds the code to your app after you approve it" (linked from the event page as "Get the prompt", and at https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent). Using it is explicitly allowed by the event ("Can I use AI coding tools? Yes."). For Track 02, the winning move is to build the *productised, safer, more general* version of that prompt — not to submit the prompt itself.

---

## 3. Event rules — what the event page actually says

Source: https://www.wemakedevs.org/hackathons/flagsmith (read in full, 19 Nov 2026). Quotes are verbatim.

**The required loop** ("How a round is played"):

> "Build a project with Flagsmith. Use feature flags to ship it, and use Experimentation to find out which version wins."
> 1. "Create a flag — A multivariate flag holds the versions you want to compare."
> 2. "Pick a metric — Choose the event that counts as success, like a click or a sign-up."
> 3. "Split the traffic — Decide how many users join the test and how they are split."
> 4. "Ship the winner — Flagsmith shows the win probability for each version. Roll the winner out with the same flag."

**Dates:**

> "**When is the hackathon?** November 26 to 29, 2026. Hacking starts at 8 AM IST on November 26, and submissions close at 8 PM IST on November 29."

**Pre-existing code / work created during the window:** The page states **no rule** requiring all work to be created during 26–29 Nov, and **no rule about pre-existing code** either way. There is no "all code must be written during the hackathon" clause on the page (unlike some other events Pintu has entered). What the page does say about building:

> "**Can I use AI coding tools?** Yes. Flagsmith even has a setup prompt for coding agents. You still need to understand and explain what you built."

Prudent reading: nothing forbids prep (specs, boilerplate, a Flagsmith account, warehouse connection) before the window, and the organisers themselves hand out a coding-agent setup prompt — but since the page is silent, the safe posture is to do the substantive build inside the window and be able to explain all of it. Do not assume a stricter rule exists; do not assume reuse of a finished prior project would be welcomed either.

**Team size:**

> "**Can I build on my own?** Yes. You can build solo or with a team."
> "**Who can take part?** Developers from anywhere in the world. The hackathon is online and free to enter."

**No maximum team size is stated anywhere on the page.** Solo is explicitly fine.

**Flagsmith must be core:**

> "**Do I have to use Flagsmith?** Yes. Flagsmith has to be a core part of your project."
> "**Is Flagsmith free to use?** Flagsmith is open source, so you can self-host it for free. You can also start on Flagsmith Cloud for free."

**Registration:** "Sign in or create a free WeMakeDevs account, then click Register now on this page." Help is via the Flagsmith Discord. (Registration itself was out of scope for this research and has not been done.)

**Judging — the scorecard (all tracks):**

> 1. "**Use of Flagsmith** — Is Flagsmith a core part of the project? Do the flags or the experiments do real work?"
> 2. "**Impact** — Does it solve a real problem? Would a developer or a team actually use it?"
> 3. "**Creativity** — Is the idea new, or does it take a familiar idea somewhere new?"
> 4. "**Demo video** — Does the video clearly show the problem, what you built and how Flagsmith fits in?"

**Per-track judging specifics:**

> **Track 01 — Test Something Real:** "A clear question to test · Versions behind a flag · A metric from real events · Results you can explain"
>
> **Track 02 — AI Agents and Feature Flags:** "Flagsmith CLI, API or MCP server · Saves real time · A human approves changes · Clear output"
> Track description: "Build an agent or a tool that works with Flagsmith for you, like setting up experiments from a prompt." ($1,000 cash)
>
> **Track 03 — Build on Open Source Flagsmith:** "Self-hosted Flagsmith · Integrations and plugins · Developer tools · Easy for others to reuse" (prize: PS5 + GTA 6 bundle)

**Bonus:** "One person who stars Flagsmith on GitHub is picked at random and wins a pair of AirPods." (Free to enter — worth doing regardless of track.)

---

## 4. Track recommendation: 01 vs 02

### 4.1 Scoring (for a solo React/TypeScript/Node developer with strong AI-agent experience)

| Criterion | Track 01 — Test Something Real ($2,000) | Track 02 — AI Agents and Feature Flags ($1,000) |
|---|---|---|
| Prize | **5/5** — $2,000 cash, double Track 02 | 3/5 — $1,000 cash |
| Fit to Pintu's strengths | 3/5 — solid full-stack build, but the differentiator is traffic + product sense, not his edge | **5/5** — agents, CLI/API tooling, LLM workflows are his demonstrated strength (multiple shipped agent projects) |
| Judging determinism | 2/5 — "A metric from real events · Results you can explain": outcome depends on data volume/quality gathered in ~84h | **5/5** — CLI/API/MCP use, time saved, human approval, clear output: all demonstrable on demand, in the demo, with no external dependency |
| Biggest risk | Results stuck at "Collecting data" (<50 identities or <5 conversions per arm) or inconclusive credible interval crossing zero — a weak results page undercuts the whole entry | Crowded obvious idea (everyone will wrap the official prompt) — must go clearly beyond it |
| Flagsmith-as-core story | **5/5** — the experiment *is* the project | 4/5 — must ensure the agent does real Flagsmith work end-to-end (create → instrument → launch → read results), not just flag CRUD |
| Demo-video strength | 4/5 — live results page with a winner banner is a great climax *if* data cooperates | **5/5** — "type a sentence → watch an experiment appear, get approved, go live, report back" is a crisp, repeatable story |
| Reuse after the event | 3/5 — the app is a one-off experiment vehicle | **5/5** — a genuinely useful dev tool; portfolio-grade |

**Verdict: Enter Track 02 as the primary.** Expected value favours it: half the prize, but a much higher probability of a complete, judgeable, on-time submission. Hedge the prize gap by making the Track 02 tool *run a real Track 01-style experiment as its demo* — the agent sets up a genuine A/B test on a small live app, drives it, and reads out the winner. That borrows Track 01's "results you can explain" magic without betting the entry on organic traffic. (One entry, one track — the event awards "the best project in each" track, so pick 02 and make the demo carry the experiment story.)

Track 03 note: requires self-hosted Flagsmith plus an integration/dashboard/plugin/starter template others can reuse. Doable (Docker Compose + Flagsmith-database warehouse), but the prize is hardware (PS5 + GTA 6), the ops overhead inside a 3.5-day window is real, and it plays to neither cash nor Pintu's agent edge. Skip unless the PS5 is specifically wanted.

### 4.2 Recommended-track concepts (Track 02)

#### Concept A — "TogglePilot": a prompt-to-experiment agent with an approval gate *(recommended)*

- **What it does:** A developer types: *"Test whether a shorter signup form converts better on my landing app."* The agent inspects the connected Flagsmith project (Management API), checks the environment has a warehouse (and stops with clear instructions if not), drafts a complete experiment plan — multivariate flag + variants with keys, metric (event name + aggregation), rollout %, split, hypothesis — and presents it for **human approval**. On approval it creates the flag/variants (CLI), creates the metric and experiment (REST API), generates the exact SDK instrumentation snippet for the app's stack (React/Next.js/Node), and — only after a second explicit approval — calls `start/`. Later, *"How is my experiment doing?"* returns a plain-English readout: enrolled users per arm, lift, credible interval, win probability, SRM/collecting-data status, and a recommendation (keep running / roll out winner).
- **Why Flagsmith Experimentation is the core:** the agent's entire job is the experimentation lifecycle — warehouse check → flag → metric → experiment → start → results. Remove Flagsmith and nothing remains.
- **Why it can win:** it is the productised version of Flagsmith's own one-prompt flow, fixing its known gaps: the MCP server can't start experiments (the agent uses CLI + REST and says so), changes are approval-gated (an explicit Track 02 judging line: "A human approves changes"), output is a readable plan + results narrative ("Clear output"), and the time saving is measurable (manual dashboard setup ≈ 20–30 min across four surfaces vs one prompt + two approvals). Judges from the Flagsmith team will recognise their own workflow, done properly.

#### Concept B — "Experiment Janitor": an agent that watches running experiments and flags stale/unsafe flags

- **What it does:** A scheduled/CLI agent that audits a Flagsmith project via the Management API: experiments stuck in "Collecting data" too long, SRM warnings, flags whose experiment ended but whose losing variants were never cleaned up, multivariate flags with unlabelled variants (the silent zero-exposure bug), and flags untouched for N days. It produces a clear report and, with human approval, performs the safe cleanups (re-weight a finished experiment's flag to 100% winner using the flag-update API, archive dead flags).
- **Why experimentation is the core:** every check is an experimentation-correctness check drawn from the docs' own failure modes (missing variant keys, SRM, quarantined identities, locked flags).
- **Why it can win:** high "would a team actually use it" impact, very clear before/after output, and it shows deep docs-level understanding rather than surface API calls. Slightly less visual than Concept A — pair it with one live experiment it monitors.

#### Concept C — "Rollout Commander": natural-language flag operations with guardrails

- **What it does:** A chat/CLI tool: *"Roll the new checkout out to 10% of users, and if the purchase rate drops, roll it back."* The agent translates intent into a multivariate flag + experiment (not just a toggle), wires the guardrail metric, monitors results via the API, and proposes — never executes without approval — rollout increases or rollback when win probability/guardrails cross thresholds.
- **Why experimentation is the core:** progressive rollout *is* an experiment here; the flag, metric and Bayesian readout drive every decision.
- **Why it can win:** strongest "impact" narrative of the three (this is how real teams ship), but the most scope: monitoring loop + threshold logic + a host app. Feasible solo only if the host app stays tiny; Concept A delivers 80% of this story with half the risk.

### 4.3 If Track 01 is entered anyway — concepts that make the experiment genuinely central

1. **Portfolio/contact-page CTA test (uses Pintu's own live traffic surface):** a small productised landing page (e.g. for one of his existing tools) where a multivariate flag serves 2–3 headline + CTA variants; metric = *Occurrence* of `cta_clicked` (or a completed contact-form `lead_submitted`). Real question, real events, winner rolled out with the same flag.
2. **Onboarding-flow test in a micro-SaaS demo:** a tiny working app (e.g. a waitlist + first-task flow) testing one-step vs three-step onboarding; metric = *Occurrence* of `onboarding_completed`. The funnel gives naturally higher conversion rates than purchases, so the ≥5-conversions-per-arm floor is reachable with modest traffic.
3. **Pricing-page layout test:** two pricing layouts behind one flag; metric = *Occurrence* of `plan_selected`, *Sum/Mean* on a `checkout_started` value event as a secondary. Classic, instantly understood by judges, easy to explain either way the result lands.

### 4.4 The honest part: what makes an experiment "real" here, and how to demo it credibly

**"Real" is defined by Flagsmith's own mechanics, not by opinion:**

- Results literally do not render below **50 identities and 5 conversions per variation**. A demo with 6 users shows "Collecting data" — judges scoring "a metric from real events" and "results you can explain" will mark that down.
- Win probability only becomes a *decision* at **>95%** (winner banner) — reaching it needs a real effect size *and* volume. With a ~5% baseline conversion and a modest lift, a few hundred identities per arm may still land "inconclusive" (credible interval crossing zero). An honestly-explained inconclusive result with a correct setup beats a miraculous 99% from 40 users — and SRM checks will expose a rigged split anyway.
- Every event must flow through the **real pipeline**: identified identity → `getExperimentFlag` exposure → `trackEvent` conversion → warehouse → Bayesian engine. Screenshots of a results page you didn't generate through that pipeline would be fabrication; generating them through the pipeline with a disclosed simulated cohort is not.

**Credible solo-builder playbook for the demo:**

1. **Use Flagsmith's own sanctioned technique.** The official coding-agent guide explicitly ends with: *"Offer to send test traffic with a short script that simulates a few hundred users, each with its own identifier: get the experiment flag for each one and track the event for some of them."* A simulator script (Node + `@flagsmith/nodejs`) that creates a few hundred distinct identities, gets the experiment flag for each (real exposures, real bucketing), and tracks conversions at a stated, realistic rate per variant produces **genuine** exposures, splits, SRM checks and Bayesian results — the statistics engine cannot tell, and does not care, that the identities came from a script.
2. **Disclose it plainly.** In the README and the demo video, label it exactly: "Seeded with a disclosed simulator: 400 identities, baseline conversion ~5%, variant ~8%." Judges reward this honesty — the instrumentation, warehouse and stats are 100% real; only the crowd is synthetic, which is the standard way to demo experimentation without a production user base. Never present simulated users as organic users.
3. **Mix in whatever real traffic is available.** Share the live app link (own portfolio visitors, WeMakeDevs/Discord community, the 23 Nov session crowd, judges clicking through). Even 20–30 real identities alongside the seeded cohort strengthens the story and costs nothing.
4. **Design for reachable significance:** pick a high-baseline metric (clicks/completions at 20–40%, not 2% purchases), a bold variant difference (bold variants move metrics more), 100% rollout with an even split, and let the experiment run from early in the window so refresh cycles accumulate. Show the Exposures panel and the "Collecting data → results" progression in the video.
5. **Pre-flight the silent failures** (§1.2 checklist): warehouse connected on day 1 (first event can take hours), every variant keyed, event name case-matched, `flushEvents()` in the simulator and the app, SDK versions at/above the minimums.

---

## 5. Practical build notes for 26–29 Nov (solo, React/TS/Node)

- **Stack:** Flagsmith Cloud Free (skip self-hosting for Tracks 01/02) → enable the **managed warehouse first thing on 26 Nov**. React (Vite or Next.js) + `@flagsmith/flagsmith` ^12.4.0 with `enableEvents: true`; Node service (if any) on `@flagsmith/nodejs` ^9.1.0, remote evaluation. Agent layer (Track 02): TypeScript service driving the Flagsmith CLI v2 + Management REST API with an explicit approval step before any mutating call, and a separate, harder gate before `experiments/<id>/start/`.
- **Session to catch:** the Flagsmith team session on **23 Nov, 21:30 IST** (before hacking starts) — the cheapest source of judging expectations and live Q&A.
- **Free-tier headroom:** 50k requests/month and 100k experiment users are ample; the real scarcities are the ~84 hours and the warehouse's first-event processing lag.
- **Demo video is 25% of the scorecard in effect** (1 of 4 criteria): script it around problem → agent/app → Flagsmith doing real work → results page → winner rolled out with the same flag.

## Sources

- Experimentation overview — https://docs.flagsmith.com/experimentation
- Connect a warehouse — https://docs.flagsmith.com/experimentation/connect-a-warehouse
- Create metrics — https://docs.flagsmith.com/experimentation/create-metrics
- Create an experiment — https://docs.flagsmith.com/experimentation/create-an-experiment
- Run an experiment (instrumentation, SDK minimums) — https://docs.flagsmith.com/experimentation/run-an-experiment
- Analyse an experiment — https://docs.flagsmith.com/experimentation/analyse-an-experiment
- Statistics glossary (Bayesian engine, SRM, collecting-data floor) — https://docs.flagsmith.com/experimentation/statistics
- Set up an experiment with a coding agent (CLI/API recipes, MCP limitation, simulator script) — https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent
- Run Flagsmith locally with a coding agent (CLI install/auth, local warehouse) — https://docs.flagsmith.com/getting-started/run-locally-with-a-coding-agent
- Multivariate / basic flag management — https://docs.flagsmith.com/managing-flags/core-management
- Updating flags (experimental API) — https://docs.flagsmith.com/managing-flags/updating-flags
- JavaScript SDK — https://docs.flagsmith.com/integrating-with-flagsmith/sdks/client-side-sdks/javascript
- React SDK — https://docs.flagsmith.com/integrating-with-flagsmith/sdks/client-side-sdks/react
- Next.js and SSR — https://docs.flagsmith.com/integrating-with-flagsmith/sdks/client-side-sdks/nextjs-and-ssr
- SDKs overview (client vs server, remote vs local evaluation, keys) — https://docs.flagsmith.com/integrating-with-flagsmith/sdks
- Management API — https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/management-api (explorer: https://api.flagsmith.com/api/v1/docs/)
- MCP server — https://docs.flagsmith.com/deployment-self-hosting/mcp-server
- Self-hosting with Docker (experimentation via Flagsmith database) — https://docs.flagsmith.com/deployment-self-hosting/hosting-guides/docker
- Experimentation product page (plans, MTUE, BYOW) — https://www.flagsmith.com/feature/experimentation-platform
- Pricing summary — https://www.flagsmith.com/compare/flagsmith-vs-launchdarkly · https://www.flagsmith.com/pricing
- Event page (rules, tracks, judging, FAQ) — https://www.wemakedevs.org/hackathons/flagsmith
