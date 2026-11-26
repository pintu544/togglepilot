# TogglePilot — submission package (pre-submission review, T-3.5)

Status: ASSEMBLED 26 Nov 2026, NOT FILED. Nothing in this file has been submitted anywhere.
Pintu reviews this exact package and approves before any filing.

## Event and deadline

- Event: Toggle Wars: The Flagsmith Experimentation Hackathon (WeMakeDevs x Flagsmith)
- Event page: https://www.wemakedevs.org/hackathons/flagsmith
- Submissions close: Sunday 29 Nov 2026, 20:00 IST (plan to this time; a social post claims 23:59 IST, treated as grace only)
- Submission mechanism: the WeMakeDevs hackathon page itself. Free WeMakeDevs account, click "Register now" on the event page, then submit the project there. No Devpost. (Confirmed from the event page FAQ and the Luma listing; the exact form fields are only visible after sign-in, so they must be confirmed in the live browser at filing time.)
- Track: Track 02 — AI Agents and Feature Flags ($1,000 cash)
- Team: solo — Pintu Kumar. Team name: Tech Bro (used on other hackathon entries; confirm at filing if the form asks for a team name)

## Fields as they will be filed (verbatim)

- Project name: TogglePilot
- Repository (public): https://github.com/pintu544/togglepilot
- Repository description (live on GitHub): "TogglePilot — describe an A/B test in one sentence; it validates, plans, gets your approval, launches it on Flagsmith, and tells you the winner in plain English."
- Repository homepage (live on GitHub): https://togglepilot-host.vercel.app
- Repository topics (live on GitHub): ab-testing, ai-agent, cli, experimentation, feature-flags, flagsmith, typescript
- README: README.md at the repo root (in the TASKS.md order: pitch, scorecard, live demo + video, workflow, Flagsmith use, architecture, run it yourself, honesty box, what's next)
- Live demo: https://togglepilot-host.vercel.app
- Demo video: runs/demo-video/togglepilot-demo.mp4 — local file, 170.0 s, 3,290,991 bytes, sha256 f320de50cb14bd1dce20e9e965e1b34d76270dd5d7f2fa49d937936de0d7771c. YouTube upload PENDING. The README carries the local path with "upload pending". The YouTube link must be added to the README before filing.
- One-line pitch (as filed): "Describe an A/B test in one sentence. TogglePilot checks the setup for silent failures, shows you the plan, waits for your approval, launches the experiment on Flagsmith, and tells you the winner in plain English."
- Description (as filed): "TogglePilot is a TypeScript/Node CLI for Track 02. It turns one sentence into a full experiment plan, runs five pre-flight checks that catch the silent failures which make experiments report zero, takes three separate human approvals (plan, start, rollout), creates the flag with the Flagsmith CLI and the metric and experiment with the REST Management API, generates the SDK instrumentation, narrates results in plain English, and rolls the winner out on the same flag. Demo experiment 590 completed live: Variant_1 won with 99.41% probability (lift 51.24%) on a disclosed seeded cohort of 400 identities and was rolled out to 100%."
- The claim (as filed): "TogglePilot catches the five silent failures that make experiments report zero. The dashboard catches none of them before launch." Measured: manual ~2 min, 10 screens, 0 of 5 traps; TogglePilot 8.5 s, 1 screen, 5 of 5 traps, 3 approvals.
- Live experiment evidence (as filed): experiment 590, completed 26 Nov 2026; control 219 identities / 64 conversions; Variant_1 181 identities / 80 conversions; lift 51.24%, 95% credible interval 11.34% to 91.15%, win probability 99.41%; flag 305212 serves "shorter_headline" at 100%. Cohort: seeded, 400 identities, about 30% control / 42% variant, never called organic.

## Projected scores (no numeric rubric is published; four criteria, qualitative)

- Use of Flagsmith: HIGH. The full lifecycle is the product (warehouse check, flag, metric, experiment, start, results, rollout). The live experiment ran on the real Flagsmith pipeline and the winner shipped on the same flag. Evidence: README "How Flagsmith is used", Architecture diagram, experiment 590 record.
- Impact: HIGH. The five silent failures waste real teams' experiments; the measured scorecard proves the catch, and the tool is usable on Monday morning. Evidence: README scorecard table, "How it works" step 2.
- Creativity: MEDIUM-HIGH. Clear, stated distance from Flagsmith's free official prompt (approval gates, pre-flight validation before creation, results narration, rollout). Capped because the core shape (prompt sets up an experiment) is the official flow, productised. Evidence: README "How it works" closing paragraph, MCP note.
- Demo video: MEDIUM-HIGH once uploaded. Proves the claim on the real system: planted trap caught, one value edited and approved, real verdict and rollout, scorecard end card with disclosure. Capped because terminal segments are stills of real output rather than live motion, there is no Flagsmith dashboard footage, and the public link does not exist yet. Evidence: runs/demo-video/togglepilot-demo.mp4 (170 s, frames + audio verified).

## Pre-filing checklist (all must be done before T-3.5 files)

1. Upload runs/demo-video/togglepilot-demo.mp4 to YouTube (parent, live browser; no browser in this session).
2. Replace the README video line with the real YouTube link; re-verify the link returns 200.
3. Pintu approves this package explicitly (repo, README, video, live links).
4. Confirm registration on the WeMakeDevs event page (Pintu's account) and read the exact submission form fields in the live browser; file only the values above.
5. After filing: click through the live links once more (host app up, video plays, repo public) and save the submission confirmation to runs/.

## Known gaps and open items

- The exact WeMakeDevs submission form fields are unconfirmed (sign-in required). Do not assume field names; read them at filing time.
- No T-0.2 baseline recording exists in the repo, so the video opens with the measured numbers as on-screen text. The README honesty box says so.
- Warehouse dashboard still shows `pending_connection` at the last API check (26 Nov 2026, 552 events received) despite results flowing through the API. Results in this repo come from API reads, not the dashboard status.
- Rehearsal experiment 633 is still running with 20 identities. End it before the next demo run; it is not part of the submission.
- Feature freeze: 29 Nov 12:00 IST. After that, packaging fixes only.
