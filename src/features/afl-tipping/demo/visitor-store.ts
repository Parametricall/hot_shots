import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import { DEMO_SEASON } from "./snapshot";

/**
 * The Demo visitor and what they leave in their own browser (docs/adr/0004):
 * their Tips and where the Demo clock was. One `localStorage` key per Season,
 * so a newer Season's snapshot ignores older saved state instead of mixing it in.
 */

export type VisitorState = { position: number | undefined; tips: AllTipsRow[] };

export type ReadVisitorResult =
  | { ok: true; state: VisitorState }
  | { ok: false; reason: "missing" | "corrupt" | "unavailable"; detail?: string };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const visitorStorageKey = (season: number) => `hot-shots:demo:${season}`;

function isTipRow(value: unknown): value is AllTipsRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.game_id === "number" &&
    typeof row.user_id === "string" &&
    typeof row.tip === "number" &&
    (row.margin === null || typeof row.margin === "number") &&
    (row.is_underdog === null || typeof row.is_underdog === "boolean") &&
    typeof row.created_at === "string"
  );
}

function parseState(text: string): ReadVisitorResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: "corrupt", detail: err instanceof Error ? err.message : undefined };
  }
  if (typeof value !== "object" || value === null) return { ok: false, reason: "corrupt" };
  const { position, tips } = value as Record<string, unknown>;
  if (
    (position !== undefined && typeof position !== "number") ||
    !Array.isArray(tips) ||
    !tips.every(isTipRow)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  return { ok: true, state: { position: position as number | undefined, tips } };
}

/**
 * The visitor's saved state. `localStorage` can be missing or throw (private
 * windows, blocked site data), so every access is guarded and the state also
 * lives in memory: the Demo still works for the session, it just isn't kept.
 */
export function createVisitorStore(getStorage: () => StorageLike | undefined, season: number) {
  const key = visitorStorageKey(season);
  let memory: VisitorState | undefined;

  const storage = (): StorageLike | undefined => {
    try {
      return getStorage();
    } catch {
      return undefined;
    }
  };

  function read(): ReadVisitorResult {
    const store = storage();
    if (!store) {
      return memory ? { ok: true, state: memory } : { ok: false, reason: "unavailable" };
    }
    let text: string | null;
    try {
      text = store.getItem(key);
    } catch (err) {
      return {
        ok: false,
        reason: "unavailable",
        detail: err instanceof Error ? err.message : undefined,
      };
    }
    if (text === null) return { ok: false, reason: "missing" };
    return parseState(text);
  }

  function write(state: VisitorState) {
    memory = state;
    try {
      storage()?.setItem(key, JSON.stringify(state));
    } catch {
      // Quota or blocked storage: the in-memory copy carries the session.
    }
  }

  /** A missing, corrupt or unavailable value starts fresh. */
  function current(): VisitorState {
    const result = read();
    if (result.ok) return result.state;
    return memory ?? { position: undefined, tips: [] };
  }

  return {
    read,
    /** Saves a Tip, replacing the visitor's earlier Tip on the same Game. */
    saveTip(row: AllTipsRow) {
      const state = current();
      write({ ...state, tips: [...state.tips.filter((t) => t.game_id !== row.game_id), row] });
    },
    savePosition(position: number) {
      write({ ...current(), position });
    },
    clearAll() {
      memory = undefined;
      try {
        storage()?.removeItem(key);
      } catch {
        // Nothing to clear if storage is blocked.
      }
    },
  };
}

export const visitorStore = createVisitorStore(
  () => (typeof window === "undefined" ? undefined : window.localStorage),
  DEMO_SEASON,
);
