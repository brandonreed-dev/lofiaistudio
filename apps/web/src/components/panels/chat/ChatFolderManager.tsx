import { useState } from 'react';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';

interface ChatFolderManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function ChatFolderManager({ isOpen, onClose, onRefresh }: ChatFolderManagerProps) {
  const [name, setName] = useState('');
  const [folders, setFolders] = useState<Array<{ id: string; name: string; sessionIds: string[] }>>([]);

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/chat/folders');
      const data = await res.json();
      if (data.success) setFolders(data.data);
    } catch { /* ignore */ }
  };

  if (!isOpen) return null;

  return (
    <div className="orch-card" style={{ marginBottom: 12, border: '1px solid var(--border-c)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={14} />Folders
        </div>
        <button className="orch-icon-btn" style={{ width: 18, height: 18 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
        Create folders and organize your chat sessions.
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="orch-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" style={{ flex: 1 }} />
        <button className="orch-btn xs primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={async () => {
          if (!name.trim()) return;
          await fetch('/api/chat/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: crypto.randomUUID(), name: name.trim(), sessionIds: [] }),
          });
          setName('');
          loadFolders();
          onRefresh();
        }}><Plus size={12} /> Add</button>
      </div>
      {folders.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>No folders yet.</div>
      ) : (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {folders.map((f) => (
            <div key={f.id} className="orch-row" style={{ padding: '4px 8px', borderRadius: 6 }}>
              <div className="orch-row-main">
                <div className="orch-row-title" style={{ fontSize: 12 }}>{f.name}</div>
                <div className="orch-row-sub" style={{ fontSize: 10 }}>{f.sessionIds.length} sessions</div>
              </div>
              <button className="orch-icon-btn" style={{ width: 16, height: 16, color: 'var(--text-3)' }} title="Delete folder" onClick={async () => {
                await fetch(`/api/chat/folders/${f.id}`, { method: 'DELETE' });
                loadFolders();
                onRefresh();
              }}><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
