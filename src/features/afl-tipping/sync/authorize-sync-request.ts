import { timingSafeEqual } from "node:crypto";

export type SyncAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: "unauthorized" | "no-secret" };

const BEARER_PREFIX = "Bearer ";

/**
 * Whether a request to a `/api/sync/*` endpoint carries `Authorization: Bearer <secret>`
 * (`SQUIGGLE_SYNC_SECRET`). The scheduler (Supabase `pg_cron`, plan 015) sends it; nobody else may
 * start a sync, because each one spends Squiggle requests.
 *
 * The comparison is constant-time over equal-length buffers. A token of another length is rejected
 * at once: that leaks the secret's length only, which `timingSafeEqual` can't hide, and which
 * doesn't help anyone guess it. A server with no secret configured answers 503 and never accepts,
 * so a missing variable can't open the endpoint.
 */
export function authorizeSyncRequest(
  request: Request,
  secret: string | undefined,
): SyncAuthorization {
  if (!secret) {
    console.error("[sync] SQUIGGLE_SYNC_SECRET is not set; refusing every sync request");
    return { ok: false, status: 503, reason: "no-secret" };
  }
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith(BEARER_PREFIX)) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  const given = Buffer.from(header.slice(BEARER_PREFIX.length));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  return { ok: true };
}
