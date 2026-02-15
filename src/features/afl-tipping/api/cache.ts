// Server-side in-memory TTL cache — this Map persists across requests
// because the server module stays alive between page loads.
const cache = new Map<string, { data: unknown; expiry: number }>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T;
  }
  const data = await fn();
  cache.set(key, { data, expiry: Date.now() + ttlMs });
  return data;
}

/** Clear all cached entries. Exported for testing. */
export function clearCache(): void {
  cache.clear();
}
