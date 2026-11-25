export type RunLiveIngestResult =
  | { ok: true; connections: number }
  | { ok: false; reason: string; detail?: string };

/**
 * The live ingest (plan 015, D3): one Squiggle Event API connection for the whole site, writing
 * live fields to `afl_games`. It knows nothing about Vercel: the caller passes an abort `signal` and
 * a `deadline` (epoch ms) after which it must have stopped and released the lease.
 *
 * TODO(plan 015 Step 9): this is a stub so `/api/sync/live-scores` can be wired and tested. Build
 * the lease, the stream, the reconnect backoff and the run record there.
 */
export async function runLiveIngest(_options: {
  signal: AbortSignal;
  deadline: number;
}): Promise<RunLiveIngestResult> {
  return { ok: false, reason: "not-implemented" };
}
