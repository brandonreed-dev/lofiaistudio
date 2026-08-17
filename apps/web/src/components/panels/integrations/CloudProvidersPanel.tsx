import { useEffect, useState, useCallback } from 'react';
import { CLOUD_PROVIDERS } from '@lofiaistudio/shared';
import type { CloudProviderConfig } from '@lofiaistudio/shared';
import { KeyRound, CheckCircle, XCircle, RefreshCw, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

export function CloudProvidersPanel() {
  const [providers, setProviders] = useState<CloudProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, boolean>>({});

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cloud-providers');
      const json = await res.json();
      if (json.success) {
        setProviders(json.data);
      }
    } catch (err) {
      console.error('Failed to load cloud providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleSave = async (providerId: string) => {
    try {
      const providerInfo = CLOUD_PROVIDERS[providerId as keyof typeof CLOUD_PROVIDERS];
      const res = await fetch(`/api/cloud-providers/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput || undefined,
          baseUrl: baseUrlInput || undefined,
          name: providerInfo?.name || providerId,
          supportedModalities: providerInfo?.supportedModalities || [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingProvider(null);
        setApiKeyInput('');
        setBaseUrlInput('');
        await loadProviders();
      }
    } catch (err) {
      console.error('Failed to save provider:', err);
    }
  };

  const handleDelete = async (providerId: string) => {
    try {
      const res = await fetch(`/api/cloud-providers/${providerId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        await loadProviders();
      }
    } catch (err) {
      console.error('Failed to delete provider:', err);
    }
  };

  const handleValidate = async (providerId: string) => {
    setValidating(providerId);
    try {
      const res = await fetch(`/api/cloud-providers/${providerId}/validate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setValidationResults((prev) => ({ ...prev, [providerId]: json.data.valid }));
      }
    } catch (err) {
      console.error('Failed to validate provider:', err);
      setValidationResults((prev) => ({ ...prev, [providerId]: false }));
    } finally {
      setValidating(null);
    }
  };

  const isConfigured = (providerId: string) => providers.some((p) => p.id === providerId);

  return (
    <div className="orch-card">
      <div className="orch-card-header">
        <div className="orch-card-title"><KeyRound size={16} /> Cloud Providers</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
          Configure API keys for cloud-based AI model execution
        </div>
      </div>
      <div className="orch-card-body">
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
            <RefreshCw size={24} className="spin" style={{ opacity: 0.5 }} />
            <p style={{ marginTop: 8 }}>Loading providers...</p>
          </div>
        ) : (
          <div className="orch-list">
            {Object.entries(CLOUD_PROVIDERS).map(([id, info]) => {
              const configured = isConfigured(id);
              const isEditing = editingProvider === id;
              const validationResult = validationResults[id];

              return (
                <div key={id} className="orch-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <div className="orch-row-icon">
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: configured
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'var(--bg-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: configured ? '#fff' : 'var(--text-3)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {info.name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="orch-row-main">
                      <div className="orch-row-title">
                        {info.name}
                        {configured && (
                          <span className="orch-chip green" style={{ marginLeft: 8, fontSize: 10 }}>
                            <CheckCircle size={10} /> Configured
                          </span>
                        )}
                        {validationResult === true && (
                          <span className="orch-chip green" style={{ marginLeft: 4, fontSize: 10 }}>
                            Valid
                          </span>
                        )}
                        {validationResult === false && (
                          <span className="orch-chip" style={{ marginLeft: 4, fontSize: 10, color: 'var(--red)', borderColor: 'var(--red)' }}>
                            <XCircle size={10} /> Invalid
                          </span>
                        )}
                      </div>
                      <div className="orch-row-sub">
                        {info.supportedModalities.join(', ')}
                      </div>
                    </div>
                    <div className="orch-row-actions" style={{ display: 'flex', gap: 6 }}>
                      {configured && (
                        <button
                          className="orch-btn xs"
                          onClick={() => handleValidate(id)}
                          disabled={validating === id}
                        >
                          <RefreshCw size={12} className={validating === id ? 'spin' : ''} />
                          {' '}Validate
                        </button>
                      )}
                      <button
                        className="orch-btn xs"
                        onClick={() => {
                          setEditingProvider(isEditing ? null : id);
                          setApiKeyInput('');
                          setBaseUrlInput('');
                          setShowKey(false);
                        }}
                      >
                        {isEditing ? 'Cancel' : configured ? 'Update Key' : <><Plus size={12} /> Add Key</>}
                      </button>
                      {configured && (
                        <button
                          className="orch-btn xs"
                          style={{ color: 'var(--red)' }}
                          onClick={() => handleDelete(id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                          API Key
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            className="orch-input"
                            type={showKey ? 'text' : 'password'}
                            placeholder="sk-..."
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            style={{ flex: 1, fontFamily: 'monospace' }}
                          />
                          <button
                            className="orch-btn xs ghost"
                            onClick={() => setShowKey(!showKey)}
                            title={showKey ? 'Hide key' : 'Show key'}
                          >
                            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                          Base URL (optional)
                        </label>
                        <input
                          className="orch-input"
                          type="text"
                          placeholder={`https://api.${id}.com/v1`}
                          value={baseUrlInput}
                          onChange={(e) => setBaseUrlInput(e.target.value)}
                          style={{ flex: 1, fontFamily: 'monospace' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="orch-btn primary"
                          onClick={() => handleSave(id)}
                          disabled={!apiKeyInput.trim()}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}