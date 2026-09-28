// Browser stub for node:async_hooks. @tanstack/start-storage-context calls
// `new AsyncLocalStorage()` at module scope, and that module gets pulled into
// the client bundle transitively via @tanstack/react-start even though
// Storybook never runs server request handling. Vite's default browser
// externalization for node built-ins isn't a real constructor, so give it one
// that behaves well enough for module load and simple run/getStore use.

export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, callback: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}
