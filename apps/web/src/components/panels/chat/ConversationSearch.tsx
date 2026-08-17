import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';

interface ConversationSearchProps {
  onClose: () => void;
  onNavigate: (sessionId: string, messageId: string) => void;
}

interface SearchResult {
  id: string;
  sessionId: string;
  content: string;
  role: string;
  timestamp: string;
}

export function ConversationSearch({ onClose, onNavigate }: ConversationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'all' | 'current'>('all');

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const url = new URL('/api/chat/search', window.location.origin);
      url.searchParams.set('q', q);
      url.searchParams.set('scope', scope);
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh',
      background: 'rgba(0,0,0,0.4)',
    }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="orch-card" style={{ width: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
           onMouseDown={(e) => e.stopPropagation()}>
        <div className="orch-card-header">
          <div className="orch-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} />Search Conversations
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              className="orch-select"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'current')}
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              <option value="all">All sessions</option>
              <option value="current">Current session</option>
            </select>
            <button className="orch-icon-btn" style={{ width: 22, height: 22 }} onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-c)' }}>
          <input
            className="orch-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages... (type to search)"
            autoFocus
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {loading && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>Searching...</div>}
          {!loading && results.length === 0 && query && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>No messages found</div>
          )}
          {results.map((r) => (
            <div
              key={r.id}
              className="orch-row"
              style={{ cursor: 'pointer', padding: '8px 10px', margin: '2px 0', borderRadius: 6 }}
              onClick={() => onNavigate(r.sessionId, r.id)}
            >
              <div className="orch-row-main">
                <div className="orch-row-title" style={{ fontSize: 12 }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: r.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
                    marginRight: 6, verticalAlign: 'middle',
                  }} />
                  {r.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="orch-row-sub" style={{
                  fontSize: 11, lineHeight: 1.4, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.content}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(r.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '6px 12px', borderTop: '1px solid var(--border-c)',
          fontSize: 11, color: 'var(--text-3)', textAlign: 'center',
        }}>
          Press Esc to close • Click a result to jump to it
        </div>
      </div>
    </div>
  );
}