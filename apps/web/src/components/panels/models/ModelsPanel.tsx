import { useMemo, useState } from 'react';
import { EmptyState } from '../panelPrimitives.js';

export function ModelsPanel({ allModels }: { allModels: any[] }) {
  const [search, setSearch] = useState('');
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<any | null>(null);

  const modalities = useMemo(() => ['all', ...new Set(allModels.map((m) => m.modality))], [allModels]);
  const runtimes = useMemo(() => ['all', ...new Set(allModels.map((m) => m.runtime))], [allModels]);

  const filtered = useMemo(() => {
    let list = allModels;
    const q = search.toLowerCase();
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    if (modalityFilter !== 'all') list = list.filter((m) => m.modality === modalityFilter);
    if (runtimeFilter !== 'all') list = list.filter((m) => m.runtime === runtimeFilter);
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter);
    return list;
  }, [allModels, search, modalityFilter, runtimeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: allModels.length,
    text: allModels.filter((m) => m.modality === 'text').length,
    image: allModels.filter((m) => m.modality === 'image').length,
    audio: allModels.filter((m) => m.modality === 'audio').length,
    video: allModels.filter((m) => m.modality === 'video').length,
    loaded: allModels.filter((m) => m.status === 'loaded').length,
  }), [allModels]);

  return (
    <div className="orch-card">
      <div className="orch-card-header">
        <div className="orch-card-title">Models</div>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{stats.total} total · {stats.loaded} loaded</span>
      </div>
      <div className="orch-filter" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-c)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="orch-input" placeholder="Search models..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
        <select className="orch-select" value={modalityFilter} onChange={(e) => setModalityFilter(e.target.value)} style={{ width: 100 }}>
          {modalities.map((m) => <option key={m} value={m}>{m === 'all' ? 'All' : m}</option>)}
        </select>
        <select className="orch-select" value={runtimeFilter} onChange={(e) => setRuntimeFilter(e.target.value)} style={{ width: 120 }}>
          {runtimes.map((r) => <option key={r} value={r}>{r === 'all' ? 'All runtimes' : r}</option>)}
        </select>
        <select className="orch-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 100 }}>
          <option value="all">All status</option>
          <option value="loaded">Loaded</option>
          <option value="unloaded">Unloaded</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div className="orch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, padding: 12 }}>
        {filtered.map((model) => (
          <div
            className="orch-model"
            key={`${model.runtime}:${model.id}`}
            onClick={() => setSelectedModel(selectedModel?.id === model.id && selectedModel?.runtime === model.runtime ? null : model)}
            style={{ cursor: 'pointer', border: selectedModel?.id === model.id && selectedModel?.runtime === model.runtime ? '1px solid var(--accent)' : undefined }}
          >
            <div className="orch-model-head">
              <div className="orch-model-logo">{model.modality[0].toUpperCase()}</div>
              <div className="orch-model-meta">
                <div className="orch-model-name">{model.name}</div>
                <div className="orch-model-author">{model.runtime}</div>
              </div>
            </div>
            <div className="orch-model-desc">
              {model.modality} model {model.status === 'loaded' ? 'ready for local inference' : 'available from runtime'}
            </div>
            <div className="orch-model-stats">
              <span className={`orch-chip ${model.status === 'loaded' ? 'green' : model.status === 'error' ? 'red' : ''}`}>{model.status}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{model.id}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState title="No models match your filters." />
          </div>
        )}
      </div>
      {selectedModel && (
        <div className="orch-card" style={{ margin: '0 12px 12px', border: '1px solid var(--border-c)' }}>
          <div className="orch-card-header">
            <div className="orch-card-title">{selectedModel.name}</div>
            <button className="orch-icon-btn" onClick={() => setSelectedModel(null)}>✕</button>
          </div>
          <div className="orch-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><strong>ID:</strong> {selectedModel.id}</div>
            <div><strong>Runtime:</strong> {selectedModel.runtime}</div>
            <div><strong>Modality:</strong> {selectedModel.modality}</div>
            <div><strong>Status:</strong> <span className={`orch-chip ${selectedModel.status === 'loaded' ? 'green' : selectedModel.status === 'error' ? 'red' : ''}`}>{selectedModel.status}</span></div>
            {selectedModel.contextLength && <div><strong>Context:</strong> {selectedModel.contextLength.toLocaleString()} tokens</div>}
            {selectedModel.metadata?.fileSize && <div><strong>Size:</strong> {selectedModel.metadata.fileSize}</div>}
            {selectedModel.metadata?.quantization && <div><strong>Quantization:</strong> {selectedModel.metadata.quantization}</div>}
            {selectedModel.metadata?.family && <div><strong>Family:</strong> {selectedModel.metadata.family}</div>}
          </div>
        </div>
      )}
    </div>
  );
}