import { useEffect, useRef, useState, ChangeEvent, KeyboardEvent } from 'react';
import { useNeovimStore } from '@/stores/code';
import { Terminal, X } from 'lucide-react';
import { EmptyState } from '../panelPrimitives';

export function CodePanel() {
  const { connected, host, buffers, activeBufferId, mode, cursor, setConnected, setBuffers, setActiveBuffer, updateBuffer, setMode, setCursor, setLastError } = useNeovimStore();
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  const activeBuffer = buffers.find((b) => b.id === activeBufferId) ?? buffers[0] ?? null;

  useEffect(() => {
    if (outputRef.current && activeBuffer) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeBuffer?.content.length]);

  const connect = () => {
    if (!host) return;
    setLastError(null);
    // Placeholder: connect to nvim-ujp or websocket
    setConnected(true, host);
  };

  const disconnect = () => {
    setConnected(false);
    setBuffers([]);
    setActiveBuffer(null);
  };

  const sendKeys = () => {
    if (!activeBuffer) return;
    const newContent = [...activeBuffer.content, `> ${input}`];
    updateBuffer(activeBuffer.id, newContent);
    setInput('');
    // Placeholder: send input to nvim
  };

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Neovim</h1>
          <p className="orch-view-subtitle">Connect to a local Neovim instance for inline editing</p>
        </div>
        <div className="orch-view-actions">
          {!connected ? (
            <>
              <input
                className="orch-input"
                placeholder="nvim --listen /tmp/nvim"
                value={host ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConnected(false, e.target.value)}
                style={{ width: 256 }}
              />
              <button className="orch-btn primary" onClick={connect} disabled={!host}>
                <Terminal size={14} />
                Connect
              </button>
            </>
          ) : (
            <button className="orch-btn ghost" onClick={disconnect}>
              <X size={14} />
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">Buffers</div>
          <span className="orch-chip blue">{buffers.length}</span>
        </div>
        <div className="orch-card-body">
          {!connected && (
            <EmptyState title="Not connected" subtitle="Enter a Neovim socket path and connect." />
          )}
          {connected && buffers.length === 0 && (
            <EmptyState title="No buffers open" subtitle="Open a file in Neovim to see buffers here." />
          )}
          <div className="orch-list">
            {buffers.map((b) => (
              <div key={b.id} className={`orch-row${b.id === activeBufferId ? ' selected' : ''}`} onClick={() => setActiveBuffer(b.id)}>
                <div className="orch-row-icon"><Terminal size={14} /></div>
                <div className="orch-row-main">
                  <div className="orch-row-title">{b.name}</div>
                  <div className="orch-row-sub">{b.lineCount} lines</div>
                </div>
                <span className={`orch-chip ${b.modified ? 'amber' : 'green'}`}>{b.modified ? 'modified' : 'clean'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeBuffer && (
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">{activeBuffer.name}</div>
            <span className="orch-chip purple">{mode}</span>
          </div>
          <div className="orch-card-body">
            <div ref={outputRef} className="orch-code" style={{ minHeight: 200, maxHeight: '50vh', overflowY: 'auto', background: 'var(--bg-1)', padding: 12, borderRadius: 6 }}>
              {activeBuffer.content.map((line, i) => (
                <div key={i}>{line || ' '}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                className="orch-input"
                value={input}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); sendKeys(); } }}
                placeholder="Send keys to nvim..."
              />
              <button className="orch-btn primary" onClick={sendKeys}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
