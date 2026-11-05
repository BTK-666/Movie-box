import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs an async loader, keeping the last good value while a reload is in flight. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    // `cancelled` guards against out-of-order responses; `alive` against unmount.

    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((value) => {
        if (!cancelled && alive.current) setData(value);
      })
      .catch((err) => {
        if (!cancelled && alive.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled && alive.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}

/* ------------------------------------------------------------------ */
/* Stale-while-revalidate cache                                       */
/* ------------------------------------------------------------------ */

interface CacheEntry<T> {
  value: T;
  at: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

const PERSIST_KEY = 'mb-cache-v1';
/** Keep the persisted blob small; only the newest few screens are worth it. */
const PERSIST_MAX_ENTRIES = 12;
const PERSIST_MAX_BYTES = 1_500_000;

let restored = false;

function restore() {
  if (restored) return;
  restored = true;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.at === 'number') memory.set(k, v);
    }
  } catch {
    /* corrupt or unavailable storage — start cold */
  }
}

function persist() {
  try {
    const entries = [...memory.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, PERSIST_MAX_ENTRIES);
    const blob = JSON.stringify(Object.fromEntries(entries));
    if (blob.length > PERSIST_MAX_BYTES) {
      // Drop the oldest half and retry once.
      const half = Object.fromEntries(entries.slice(0, Math.ceil(entries.length / 2)));
      localStorage.setItem(PERSIST_KEY, JSON.stringify(half));
    } else {
      localStorage.setItem(PERSIST_KEY, blob);
    }
  } catch {
    /* quota exceeded or storage unavailable */
  }
}

/** Cached data is served instantly; a refresh still runs in the background. */
export function readCache<T>(key: string, maxAgeMs: number): T | undefined {
  restore();
  const hit = memory.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value;
  return undefined;
}

export function writeCache<T>(key: string, value: T) {
  memory.set(key, { value, at: Date.now() });
  persist();
}

export function clearCache() {
  memory.clear();
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Like `useAsync`, but a cached value is returned immediately while the loader
 * refreshes in the background. Screens that are revisited (Home, Browse) render
 * from cache instead of blocking on a 500 KB round trip.
 */
export function useCachedAsync<T>(
  key: string,
  loader: () => Promise<T>,
  deps: unknown[],
  maxAgeMs = 5 * 60 * 1000,
): AsyncState<T> {
  const cached = readCache<T>(key, maxAgeMs);
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fresh = readCache<T>(key, maxAgeMs);
    if (fresh !== undefined) {
      setData(fresh);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    loader()
      .then((value) => {
        if (cancelled || !alive.current) return;
        writeCache(key, value);
        setData(value);
      })
      .catch((err) => {
        if (cancelled || !alive.current) return;
        // Keep showing stale data rather than replacing it with an error.
        if (fresh === undefined) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled && alive.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps, nonce]);

  const reload = useCallback(() => {
    memory.delete(key);
    persist();
    setNonce((n) => n + 1);
  }, [key]);

  return { data, loading, error, reload };
}
