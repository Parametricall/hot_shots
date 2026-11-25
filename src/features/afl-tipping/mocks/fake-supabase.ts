import type { SupabaseClient } from "@supabase/supabase-js";

/** One query the code under test sent, as the fake saw it. */
export type FakeCall = {
  table: string;
  op: "select" | "upsert" | "insert";
  /** The columns of a `select`. */
  columns?: string;
  /** The rows of an `upsert` or `insert`. */
  rows?: unknown;
  options?: Record<string, unknown>;
  /** Every filter and modifier chained on, in order: `eq`, `in`, `gte`, `order`, `range` … */
  filters: { method: string; args: unknown[] }[];
};

export type FakeReply = { data?: unknown; error?: { message: string } | null };

const FILTER_METHODS = [
  "eq",
  "neq",
  "in",
  "gt",
  "gte",
  "lt",
  "lte",
  "is",
  "not",
  "order",
  "limit",
  "range",
] as const;

type FakeQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns?: string) => FakeQuery;
  upsert: (rows: unknown, options?: Record<string, unknown>) => FakeQuery;
  insert: (rows: unknown) => FakeQuery;
} & Record<(typeof FILTER_METHODS)[number], (...args: unknown[]) => FakeQuery>;

/** The arguments of the first filter called `method`, or undefined if the query didn't use it. */
export function filterArgs(call: FakeCall, method: string): unknown[] | undefined {
  return call.filters.find((filter) => filter.method === method)?.args;
}

/**
 * A stand-in for the supabase-js client in repository tests. Every awaited query is recorded in
 * `calls` and answered by `respond`, which sees the whole call: so a test answers a `select` from
 * a table's rows, or checks what an `upsert` sent. A query with no reply data resolves to `null`
 * data and no error.
 */
export function createFakeSupabase(respond: (call: FakeCall) => FakeReply | undefined) {
  const calls: FakeCall[] = [];

  function query(table: string): FakeQuery {
    const call: FakeCall = { table, op: "select", filters: [] };
    const self = {
      select: (columns?: string) => {
        // `.upsert(…).select()` asks for the written rows back: it stays an upsert.
        if (call.op === "select") call.columns = columns;
        return self;
      },
      upsert: (rows: unknown, options?: Record<string, unknown>) => {
        call.op = "upsert";
        call.rows = rows;
        if (options) call.options = options;
        return self;
      },
      insert: (rows: unknown) => {
        call.op = "insert";
        call.rows = rows;
        return self;
      },
      then: (
        onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        calls.push(call);
        const reply = respond(call) ?? {};
        return Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null }).then(
          onFulfilled,
          onRejected,
        );
      },
    } as unknown as FakeQuery;
    for (const method of FILTER_METHODS) {
      (self as Record<string, unknown>)[method] = (...args: unknown[]) => {
        call.filters.push({ method, args });
        return self;
      };
    }
    return self;
  }

  return { supabase: { from: query } as unknown as SupabaseClient, calls };
}
