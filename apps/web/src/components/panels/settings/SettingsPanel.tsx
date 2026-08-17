import { useEffect, useState } from 'react';
import { HardDrive, KeyRound, Server } from 'lucide-react';
import { useSettingsStore, useAppStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import { CloudProvidersPanel } from '../integrations/CloudProvidersPanel.js';

export function SettingsPanel() {
  const { settings, isLoading, fetchSettings, updateSettings } = useSettingsStore();
  const { pushToast } = useOrchestrationStore();
  const { theme: appTheme, setTheme: setAppTheme } = useAppStore();

  const [runtimes, setRuntimes] = useState({ ollama: '', comfyui: '', qwen3Audio: '', a1111: '' });
  const [theme, setLocalTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [textParams, setTextParams] = useState({ temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, maxTokens: 2048 });
  const [imageParams, setImageParams] = useState({ steps: 20, cfgScale: 7.5, sampler: 'euler', scheduler: 'normal', width: 512, height: 512, batchSize: 1 });
  const [audioParams, setAudioParams] = useState<{ language: string; speed: number; pitch: number; outputFormat: 'mp3' | 'wav' | 'ogg' }>({ language: 'auto', speed: 1.0, pitch: 1.0, outputFormat: 'wav' });
  const [videoParams, setVideoParams] = useState({ steps: 15, cfgScale: 5, sampler: 'uni_pc', scheduler: 'simple', width: 768, height: 512, frames: 16, fps: 20 });
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setRuntimes({
        ollama: settings.runtimes?.ollama ?? 'http://localhost:11434',
        comfyui: settings.runtimes?.comfyui ?? 'http://localhost:8188',
        qwen3Audio: settings.runtimes?.qwen3Audio ?? 'http://localhost:8001',
        a1111: settings.runtimes?.a1111 ?? 'http://localhost:7860',
      });
      setLocalTheme(settings.theme ?? 'system');
      if (settings.defaultParams?.text) {
        setTextParams({
          temperature: settings.defaultParams.text.temperature ?? 0.7,
          topP: settings.defaultParams.text.topP ?? 0.9,
          topK: settings.defaultParams.text.topK ?? 40,
          repeatPenalty: settings.defaultParams.text.repeatPenalty ?? 1.1,
          maxTokens: settings.defaultParams.text.maxTokens ?? 2048,
        });
      }
      if (settings.defaultParams?.image) {
        setImageParams({
          steps: settings.defaultParams.image.steps ?? 20,
          cfgScale: settings.defaultParams.image.cfgScale ?? 7.5,
          sampler: settings.defaultParams.image.sampler ?? 'euler',
          scheduler: settings.defaultParams.image.scheduler ?? 'normal',
          width: settings.defaultParams.image.width ?? 512,
          height: settings.defaultParams.image.height ?? 512,
          batchSize: settings.defaultParams.image.batchSize ?? 1,
        });
      }
      if (settings.defaultParams?.audio) {
        setAudioParams({
          language: settings.defaultParams.audio.language ?? 'auto',
          speed: settings.defaultParams.audio.speed ?? 1.0,
          pitch: settings.defaultParams.audio.pitch ?? 1.0,
          outputFormat: settings.defaultParams.audio.outputFormat ?? 'wav',
        });
      }
      if (settings.defaultParams?.video) {
        setVideoParams({
          steps: settings.defaultParams.video.steps ?? 15,
          cfgScale: settings.defaultParams.video.cfgScale ?? 5,
          sampler: settings.defaultParams.video.sampler ?? 'uni_pc',
          scheduler: settings.defaultParams.video.scheduler ?? 'simple',
          width: settings.defaultParams.video.width ?? 768,
          height: settings.defaultParams.video.height ?? 512,
          frames: settings.defaultParams.video.frames ?? 16,
          fps: settings.defaultParams.video.fps ?? 20,
        });
      }
    }
  }, [settings]);

  const saveRuntimes = async () => {
    setSaving('runtimes');
    await updateSettings({ runtimes });
    setSaving(null);
    pushToast('Runtime endpoints saved');
  };

  const saveTheme = async () => {
    setSaving('theme');
    await updateSettings({ theme });
    setAppTheme(theme);
    setSaving(null);
    pushToast('Theme saved');
  };

  const saveTextDefaults = async () => {
    setSaving('text');
    const current = settings?.defaultParams ?? {};
    await updateSettings({ defaultParams: { ...current, text: textParams } });
    setSaving(null);
    pushToast('Text defaults saved');
  };

  const saveImageDefaults = async () => {
    setSaving('image');
    const current = settings?.defaultParams ?? {};
    await updateSettings({ defaultParams: { ...current, image: imageParams } });
    setSaving(null);
    pushToast('Image defaults saved');
  };

  const saveAudioDefaults = async () => {
    setSaving('audio');
    const current = settings?.defaultParams ?? {};
    await updateSettings({ defaultParams: { ...current, audio: audioParams } });
    setSaving(null);
    pushToast('Audio defaults saved');
  };

  const saveVideoDefaults = async () => {
    setSaving('video');
    const current = settings?.defaultParams ?? {};
    await updateSettings({ defaultParams: { ...current, video: videoParams } });
    setSaving(null);
    pushToast('Video defaults saved');
  };

  const testConnection = async (runtime: string, url: string) => {
    setTesting(runtime);
    setTestResults((prev) => ({ ...prev, [runtime]: null }));
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      setTestResults((prev) => ({ ...prev, [runtime]: res.ok }));
    } catch {
      setTestResults((prev) => ({ ...prev, [runtime]: false }));
    }
    setTesting(null);
  };

  if (isLoading && !settings) {
    return <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading settings...</div>;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-c)',
    background: 'var(--bg-2)',
    color: 'var(--text-1)',
    fontSize: 13,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-2)',
    marginBottom: 4,
    display: 'block',
  };

  const smallInput: React.CSSProperties = {
    ...inputStyle,
    width: 80,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── RUNTIME ENDPOINTS ─────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title"><Server size={16} /> Runtime Endpoints</div>
        </div>
        <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['ollama', 'comfyui', 'qwen3Audio', 'a1111'] as const).map((rt) => (
            <div key={rt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ ...labelStyle, width: 100, marginBottom: 0, textTransform: 'capitalize' }}>{rt === 'qwen3Audio' ? 'Qwen3 Audio' : rt === 'a1111' ? 'A1111' : rt}</label>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={runtimes[rt]}
                onChange={(e) => setRuntimes((prev) => ({ ...prev, [rt]: e.target.value }))}
              />
              <button
                className="orch-btn xs"
                onClick={() => testConnection(rt, runtimes[rt])}
                disabled={testing === rt}
                style={{ minWidth: 100 }}
              >
                {testing === rt ? 'Testing...' : 'Test'}
              </button>
              {testResults[rt] === true && <span style={{ color: 'var(--green)', fontSize: 18 }}>✓</span>}
              {testResults[rt] === false && <span style={{ color: 'var(--red)', fontSize: 18 }}>✗</span>}
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button className="orch-btn primary" onClick={saveRuntimes} disabled={saving === 'runtimes'}>
              {saving === 'runtimes' ? 'Saving...' : 'Save Endpoints'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── OUTPUT DIRECTORY ──────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title"><HardDrive size={16} /> Output Directory</div>
        </div>
        <div className="orch-card-body">
          <label style={labelStyle}>Current output path</label>
          <input
            style={{ ...inputStyle, opacity: 0.7 }}
            value={settings?.outputDir ?? '~/.lofiaistudio/outputs'}
            readOnly
          />
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            Output directory is configured on the server. Edit <code style={{ background: 'var(--bg-3)', padding: '1px 4px', borderRadius: 3 }}>~/.lofiaistudio/lofiaistudio.json</code> to change it.
          </p>
        </div>
      </div>

      {/* ─── THEME ─────────────────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            Theme
          </div>
        </div>
        <div className="orch-card-body">
          <div className="orch-segmented" style={{ display: 'inline-flex' }}>
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                className={theme === t ? 'active' : ''}
                onClick={() => {
                  setLocalTheme(t);
                  setAppTheme(t);
                }}
                style={{ textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="orch-btn primary" onClick={saveTheme} disabled={saving === 'theme'}>
              {saving === 'theme' ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── DEFAULT GENERATION PARAMETERS ─────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Default Generation Parameters
          </div>
        </div>
        <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--accent-2)' }}>Text</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {(['temperature', 'topP', 'topK', 'repeatPenalty', 'maxTokens'] as const).map((key) => (
                <div key={key}>
                  <label style={labelStyle}>{key === 'topP' ? 'Top P' : key === 'topK' ? 'Top K' : key === 'repeatPenalty' ? 'Repeat Penalty' : key === 'maxTokens' ? 'Max Tokens' : 'Temperature'}</label>
                  <input style={smallInput} type="number" step={key === 'topK' || key === 'maxTokens' ? 1 : 0.05} value={textParams[key]} onChange={(e) => setTextParams((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            <button className="orch-btn primary xs" style={{ marginTop: 10 }} onClick={saveTextDefaults} disabled={saving === 'text'}>
              {saving === 'text' ? 'Saving...' : 'Save Text Defaults'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-c)', paddingTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--accent-2)' }}>Image</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {(['steps', 'cfgScale', 'width', 'height', 'batchSize'] as const).map((key) => (
                <div key={key}>
                  <label style={labelStyle}>{key === 'cfgScale' ? 'CFG Scale' : key === 'batchSize' ? 'Batch Size' : key}</label>
                  <input style={smallInput} type="number" step={key === 'cfgScale' ? 0.5 : 1} value={imageParams[key]} onChange={(e) => setImageParams((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Sampler</label>
                <select style={inputStyle} value={imageParams.sampler} onChange={(e) => setImageParams((prev) => ({ ...prev, sampler: e.target.value }))}>
                  {['euler', 'euler_a', 'dpm++_2m', 'dpm++_2s_a', 'uni_pc', 'lcm'].map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Scheduler</label>
                <select style={inputStyle} value={imageParams.scheduler} onChange={(e) => setImageParams((prev) => ({ ...prev, scheduler: e.target.value }))}>
                  {['normal', 'karras', 'exponential', 'sgm_uniform', 'simple'].map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>
            <button className="orch-btn primary xs" style={{ marginTop: 10 }} onClick={saveImageDefaults} disabled={saving === 'image'}>
              {saving === 'image' ? 'Saving...' : 'Save Image Defaults'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-c)', paddingTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--accent-2)' }}>Audio</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              <div><label style={labelStyle}>Language</label><input style={smallInput} value={audioParams.language} onChange={(e) => setAudioParams((prev) => ({ ...prev, language: e.target.value }))} /></div>
              <div><label style={labelStyle}>Speed</label><input style={smallInput} type="number" step={0.1} value={audioParams.speed} onChange={(e) => setAudioParams((prev) => ({ ...prev, speed: parseFloat(e.target.value) || 1 }))} /></div>
              <div><label style={labelStyle}>Pitch</label><input style={smallInput} type="number" step={0.1} value={audioParams.pitch} onChange={(e) => setAudioParams((prev) => ({ ...prev, pitch: parseFloat(e.target.value) || 1 }))} /></div>
              <div>
                <label style={labelStyle}>Output Format</label>
                <select style={inputStyle} value={audioParams.outputFormat} onChange={(e) => setAudioParams((prev) => ({ ...prev, outputFormat: e.target.value as 'mp3' | 'wav' | 'ogg' }))}>
                  {['wav', 'mp3', 'ogg'].map((f) => (<option key={f} value={f}>{f}</option>))}
                </select>
              </div>
            </div>
            <button className="orch-btn primary xs" style={{ marginTop: 10 }} onClick={saveAudioDefaults} disabled={saving === 'audio'}>
              {saving === 'audio' ? 'Saving...' : 'Save Audio Defaults'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-c)', paddingTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--accent-2)' }}>Video</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {(['steps', 'cfgScale', 'width', 'height', 'frames', 'fps'] as const).map((key) => (
                <div key={key}>
                  <label style={labelStyle}>{key === 'cfgScale' ? 'CFG Scale' : key}</label>
                  <input style={smallInput} type="number" step={key === 'cfgScale' ? 0.5 : 1} value={videoParams[key]} onChange={(e) => setVideoParams((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Sampler</label>
                <select style={inputStyle} value={videoParams.sampler} onChange={(e) => setVideoParams((prev) => ({ ...prev, sampler: e.target.value }))}>
                  {['uni_pc', 'euler', 'dpm++_2m', 'lcm'].map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Scheduler</label>
                <select style={inputStyle} value={videoParams.scheduler} onChange={(e) => setVideoParams((prev) => ({ ...prev, scheduler: e.target.value }))}>
                  {['simple', 'normal', 'karras'].map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>
            <button className="orch-btn primary xs" style={{ marginTop: 10 }} onClick={saveVideoDefaults} disabled={saving === 'video'}>
              {saving === 'video' ? 'Saving...' : 'Save Video Defaults'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── CLOUD PROVIDERS ───────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title"><KeyRound size={16} /> Cloud Providers</div>
        </div>
        <div className="orch-card-body">
          <CloudProvidersPanel />
        </div>
      </div>

      {/* ─── ABOUT ─────────────────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            About
          </div>
        </div>
        <div className="orch-card-body" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div><strong>LoFi AI Studio</strong> — Local First AI orchestration platform</div>
          <div><strong>License:</strong> MIT</div>
          <div><strong>Database:</strong> <code style={{ background: 'var(--bg-3)', padding: '1px 4px', borderRadius: 3 }}>~/.lofiaistudio/lofiaistudio.json</code></div>
          <div style={{ marginTop: 8 }}>
            <a href="https://github.com/brandonreed-dev/lofiaistudio" target="_blank" rel="noopener noreferrer" className="orch-btn xs" style={{ textDecoration: 'none' }}>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}