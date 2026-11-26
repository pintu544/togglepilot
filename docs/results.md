# Results narrator

From the repository root, with the Flagsmith keys exported in your environment:

```sh
npm run build
npm start -- results
npm start -- results --experiment-id 590 --refresh
```

The experiment ID comes from `--experiment-id`, then `TOGGLEPILOT_EXPERIMENT_ID`, then 590. The command uses Management API authentication (`Authorization: Api-Key <key>`).

## Flagsmith API

The [Management API OpenAPI explorer](https://api.flagsmith.com/api/v1/docs/) and its [JSON schema](https://api.flagsmith.com/api/v1/swagger.json) list these operations:

- `GET https://api.flagsmith.com/api/v1/environments/{environment_api_key}/experiments/{experiment_id}/results/` reads the warehouse results. This is the endpoint used by the T-2.2 dry run.
- `GET .../experiments/{experiment_id}/` supplies metric, arm and allocation metadata. `GET .../experiments/{experiment_id}/exposures/` supplies enrollment counts when the results lack them.
- `POST .../experiments/{experiment_id}/results/refresh/` queues asynchronous computation on an eligible `--refresh` for a started experiment with non-final results. The command prints the snapshot available at the time of the request. The next eligible read can pick up the new computation. See [Flagsmith's experiment setup guide](https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent).

The [Flagsmith dashboard types](https://github.com/Flagsmith/flagsmith/blob/main/frontend/common/types/responses.ts) describe the nested payload. In an occurrence metric, `n` is enrolled identities and `sum` is converted identities. The readout uses Flagsmith's `as_of` when available and labels the API read time when there is no results timestamp.

## Interpretation

The readout labels vendor estimates **Flagsmith**. It requires 50 identities per arm, plus five conversions per arm for occurrence metrics. Explicitly withheld inference stays in **Collecting data**. An SRM p-value below 0.001 shows the observed and configured splits and suppresses recommendations. Win probabilities above 95% are **Winning**, below 5% are **Losing**, and 5% through 95% inclusive are **Inconclusive**.

When an occurrence result supplies counts but omits inference for a variation, the readout labels the fallback **TogglePilot Bayesian estimate**. Each arm uses an independent Beta(1,1) prior. With `k` conversions out of `n` identities, the posterior is Beta(`k+1`, `n-k+1`). The fallback uses a normal approximation. For win probability, the posterior difference uses the difference of the means and the sum of the variances, with the sign reversed for lower-is-better metrics. For lift, the point estimate is the ratio of posterior means minus one. The 95% credible interval uses the first-order delta-method variance of that ratio, a 1.96 standard-deviation margin and a lower bound of −100%. The sample floors apply to this approximation too.

## Cache

`runs/.results-cache.json` holds the last response and fetch time per API host, environment and experiment. Within five minutes, a normal read serves the cached response and `--refresh` explains when it can try again. At five minutes the next read fetches live. Flagsmith also enforces its own server-side compute throttle.
