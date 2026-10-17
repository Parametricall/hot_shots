import { describe, it, expect } from "vite-plus/test";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import { createVisitorStore, visitorStorageKey } from "./visitor-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

const KEY = visitorStorageKey(2026);

function row(gameId: number, tip = 1): AllTipsRow {
  return {
    game_id: gameId,
    user_id: "demo-visitor",
    tip,
    margin: null,
    is_underdog: null,
    created_at: "2026-06-01T00:00:00.000Z",
  };
}

describe("visitor store", () => {
  it("reports missing storage as missing", () => {
    const storage = memoryStorage();
    const store = createVisitorStore(() => storage, 2026);
    expect(store.read()).toEqual({ ok: false, reason: "missing" });
  });

  it("saves Tips and the position, and reads them back", () => {
    const storage = memoryStorage();
    const store = createVisitorStore(() => storage, 2026);
    store.saveTip(row(1));
    store.savePosition(1234);

    const reread = createVisitorStore(() => storage, 2026).read();
    expect(reread).toEqual({ ok: true, state: { position: 1234, tips: [row(1)] } });
  });

  it("replaces the visitor's Tip on the same Game", () => {
    const storage = memoryStorage();
    const store = createVisitorStore(() => storage, 2026);
    store.saveTip(row(1, 10));
    store.saveTip(row(2, 20));
    store.saveTip(row(1, 11));
    const result = store.read();
    expect(result.ok && result.state.tips.map((t) => [t.game_id, t.tip])).toEqual([
      [2, 20],
      [1, 11],
    ]);
  });

  it("keeps one key per Season", () => {
    const storage = memoryStorage();
    createVisitorStore(() => storage, 2026).saveTip(row(1));
    expect(createVisitorStore(() => storage, 2027).read()).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("starts fresh from a corrupt value, and overwrites it on the next save", () => {
    const storage = memoryStorage({ [KEY]: "{not json" });
    const store = createVisitorStore(() => storage, 2026);
    expect(store.read()).toMatchObject({ ok: false, reason: "corrupt" });

    store.saveTip(row(1));
    expect(store.read()).toMatchObject({ ok: true });
  });

  it("treats a value of the wrong shape as corrupt", () => {
    for (const value of [
      "null",
      "[]",
      JSON.stringify({ position: "soon", tips: [] }),
      JSON.stringify({ tips: [{ game_id: "1" }] }),
      JSON.stringify({ position: 1 }),
    ]) {
      const store = createVisitorStore(() => memoryStorage({ [KEY]: value }), 2026);
      expect(store.read()).toMatchObject({ ok: false, reason: "corrupt" });
    }
  });

  it("clears everything", () => {
    const storage = memoryStorage();
    const store = createVisitorStore(() => storage, 2026);
    store.saveTip(row(1));
    store.clearAll();
    expect(storage.data.size).toBe(0);
    expect(store.read()).toEqual({ ok: false, reason: "missing" });
  });

  it("works for the session when there is no storage", () => {
    const store = createVisitorStore(() => undefined, 2026);
    expect(store.read()).toEqual({ ok: false, reason: "unavailable" });
    store.saveTip(row(1));
    expect(store.read()).toEqual({ ok: true, state: { position: undefined, tips: [row(1)] } });
    store.clearAll();
    expect(store.read()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("works for the session when storage throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createVisitorStore(() => throwing, 2026);
    expect(store.read()).toMatchObject({ ok: false, reason: "unavailable", detail: "blocked" });
    expect(() => store.saveTip(row(1))).not.toThrow();
    expect(() => store.clearAll()).not.toThrow();
  });

  it("survives the storage accessor itself throwing", () => {
    const store = createVisitorStore(() => {
      throw new Error("no localStorage");
    }, 2026);
    expect(store.read()).toEqual({ ok: false, reason: "unavailable" });
    expect(() => store.savePosition(5)).not.toThrow();
  });
});
