import { useCallback, useEffect, useMemo, useState } from 'react';

// Reusable sub-tab primitive
export function SubTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button className={`orch-subtab${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}

// Reusable field primitive
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{label}</label>
      {children}
    </div>
  );
}

// Generic local storage state hook
export function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

// Shared starred ids state
export function useStarredIds(prefix: string) {
  const [starredIds, setStarredIds] = useLocalStorageState<string[]>(`localai-${prefix}-starredIds`, []);
  const toggle = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
  }, [setStarredIds]);
  const isStarred = useCallback((id: string) => starredIds.includes(id), [starredIds]);
  return { starredIds, toggle, isStarred };
}

// Shared tags state
export function useItemTags(prefix: string) {
  const [tagsByItem, setTagsByItem] = useLocalStorageState<Record<string, string[]>>(`localai-${prefix}-tags`, {});
  const addTag = useCallback((itemId: string, tag: string) => {
    setTagsByItem((prev) => {
      const existing = prev[itemId] || [];
      if (existing.includes(tag)) return prev;
      return { ...prev, [itemId]: [...existing, tag] };
    });
  }, [setTagsByItem]);
  const removeTag = useCallback((itemId: string, tag: string) => {
    setTagsByItem((prev) => {
      const existing = prev[itemId] || [];
      const next = existing.filter((t) => t !== tag);
      return { ...prev, [itemId]: next };
    });
  }, [setTagsByItem]);
  const getTags = useCallback((itemId: string) => tagsByItem[itemId] || [], [tagsByItem]);
  return { tagsByItem, addTag, removeTag, getTags };
}

// Shared empty state
export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
      <div style={{ fontSize: 14, marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

// Shared loading state
export function LoadingState() {
  return (
    <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
      <div style={{ fontSize: 14, marginBottom: 6 }}>Loading...</div>
      <div style={{ fontSize: 12 }}>Fetching data from server</div>
    </div>
  );
}

// Shared error state
export function ErrorState({ title, message, onRetry }: { title: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>
      <div style={{ fontSize: 14, marginBottom: 6 }}>{title}</div>
      {message && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{message}</div>}
      {onRetry && (
        <button className="orch-btn primary" style={{ marginTop: 12 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

// Shared relative time helper (replaces per-panel duplicates)
export function relativeTime(value: string): string {
  const delta = Date.parse(value) - Date.now();
  const abs = Math.abs(delta);
  const suffix = delta >= 0 ? 'from now' : 'ago';
  const minutes = Math.round(abs / 60000);
  if (minutes < 1) return delta >= 0 ? 'now' : 'just now';
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  return new Date(value).toLocaleDateString();
}

// Shared trigger download helper (replaces per-panel duplicates)
export function triggerDownload(filename: string, content: unknown): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
