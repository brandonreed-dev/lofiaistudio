export function readJsonStorage<T>(
  key: string,
  fallback: T,
  storage: Pick<Storage, 'getItem'> = localStorage
): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(
  key: string,
  value: unknown,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ponytail: local preferences are best-effort; upgrade path is surfaced persistence errors.
  }
}
