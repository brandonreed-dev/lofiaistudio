import { RefreshCw, Server } from 'lucide-react';
import type { RuntimeStatus } from '@lofiaistudio/shared';
import { EmptyState } from '../panelPrimitives.js';

export function ServersPanel({
  runtimes,
  onRefresh,
  error,
}: {
  runtimes: RuntimeStatus[];
  onRefresh: () => void;
  error?: string | null;
}) {
  return (
    <div className="orch-card">
      <div className="orch-card-header">
        <div className="orch-card-title">
          <Server size={20} /> Runtime Servers
        </div>
        <button className="orch-btn primary" onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <div className="orch-card-body">
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>
            Error: {error}
          </div>
        )}
        {runtimes.length === 0 ? (
          <EmptyState title="No runtime connections found." subtitle="Click Refresh to scan for runtimes." />
        ) : (
          <div className="orch-grid orch-grid-4">
            {runtimes.map((rt) => (
              <div key={rt.type} className="orch-model" style={{ padding: 16, cursor: 'default' }}>
                <div className="orch-model-head">
                  <div className="orch-model-logo">
                    <Server size={16} />
                  </div>
                  <div className="orch-model-meta">
                    <div className="orch-model-name" style={{ textTransform: 'capitalize' }}>{rt.type}</div>
                    <div className="orch-model-author" style={{ wordBreak: 'break-all' }}>{rt.endpoint}</div>
                  </div>
                </div>
                <div className="orch-model-stats">
                  <span className={`orch-chip ${rt.connected ? 'green' : 'red'}`}>{rt.connected ? 'Connected' : 'Offline'}</span>
                  {rt.version && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>v{rt.version}</span>}
                </div>
                <div className="orch-model-desc" style={{ marginTop: 8 }}>
                  {typeof rt.vramTotal === 'number' && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      VRAM: {rt.vramUsage ?? 0} / {rt.vramTotal} MB
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {Array.isArray(rt.models) ? `${rt.models.length} model(s)` : '0 models'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
