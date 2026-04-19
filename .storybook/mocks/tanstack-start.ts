// Stub for @tanstack/react-start. Server-function modules get pulled into the
// Storybook graph via queries.ts, and the real implementation touches Node-only
// APIs (AsyncLocalStorage) at module load. This stub preserves the chainable
// builder shape so `createServerFn(...).inputValidator(...).handler(fn)` still
// evaluates; when stories exercise those queries they go through the service
// registry mocks, not the handlers.

type Handler = (input: { data: unknown }) => unknown;

type ServerFnBuilder = ((input?: unknown) => Promise<unknown>) & {
  inputValidator: (validator?: unknown) => ServerFnBuilder;
  handler: (fn: Handler) => (input?: { data?: unknown }) => Promise<unknown>;
};

export const createServerFn = (): ServerFnBuilder => {
  const builder = (() => Promise.resolve(null)) as ServerFnBuilder;
  builder.inputValidator = () => builder;
  builder.handler = (fn: Handler) => async (input) => fn({ data: input?.data ?? {} });
  return builder;
};

export const createStart = () => undefined;
