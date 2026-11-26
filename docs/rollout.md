# Roll out a winner

Run `npm start -- rollout [--experiment-id <id>] [--dry-run]` from the repo
root with the Flagsmith keys exported. The ID defaults to
`TOGGLEPILOT_EXPERIMENT_ID` or 590. The command reads fresh results without
requesting computation. A single variation must exceed 95% win probability.
Collecting data or an inconclusive verdict means keep running. An SRM warning
blocks rollout. Flagsmith normally reports probability of beating control for
each treatment. A losing treatment alone does not produce a control-win
recommendation. Gate 3 requires a separate approve/reject answer after the
command prints the recommendation. A dry run prints the proposed operation and
skips approval and changes.

## Flagsmith paths

- Flagsmith CLI v2.0.0 includes `flag update <feature> --environment <key>
  --enable --type string --value <value> --weight <variant>=<percentage>` and
  `flag get <feature> --environment <key> --json`. The [Updating Flags
  guide](https://docs.flagsmith.com/managing-flags/updating-flags) documents
  `GET/PATCH/PUT /api/__future__/environments/{key}/features/{flag_id}/`.
  PATCH preserves omitted fields. PUT replaces supplied sections in full.
  These experimental endpoints can change without notice. Change requests
  block writes, and identity overrides are outside their scope.
- The [Cloud OpenAPI schema](https://api.flagsmith.com/api/v1/swagger.json)
  exposes `POST /api/v1/environments/{key}/experiments/{id}/complete/`.
  Send `{"rollout_decision":"variant","rollout_variant":37116}` for Variant_1
  on experiment 590 or `{"rollout_decision":"control"}` to retain control.
  All requests use `Authorization: Api-Key <key>`.

[Flagsmith's setup guide](https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent)
documents the lock on running experiment flags. The
[completion implementation](https://github.com/Flagsmith/flagsmith/blob/main/api/experimentation/services.py)
sets the same flag's weights, removes the experiment's rollout override, and
completes the experiment within one transaction. TogglePilot uses this action
as the approved write. A standalone flag update followed by a separate end
call would conflict with the running-experiment lock. Control retains its
base value with zero weight on every treatment. Variant_1 gets 100% weight
and serves `shorter_headline`. The variant definitions remain available.

TogglePilot re-reads the served flag with the experimental GET and checks its
enabled state, allocations, and absence of segment overrides. It re-reads the
experiment to verify `completed`, its end time, and its recorded decision.
The flag GET cannot verify identity overrides. After Gate 3, verify the live
host app serves the winner to a fresh identity. Any failed request or
verification stops the command at that step.

## Demo fallback

If the verdict is inconclusive at demo time, show the narrator's honest
“keep running” recommendation and demonstrate rollout on the rehearsal
experiment. Decide by 28 Nov 18:00 so the fallback is never improvised on
camera.
