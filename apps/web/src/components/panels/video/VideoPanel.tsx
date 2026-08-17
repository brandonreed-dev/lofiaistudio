import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import type { VideoModel } from '@lofiaistudio/shared';
import { useVideoStore, type SortOption, type Density } from '@/stores/video';
import { useModelStore, useAppStore } from '@/stores';
import { Field, SubTab } from '../panelPrimitives';
import {
  Film,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Save,
  Star,
  Search,
  ArrowUpDown,
  Tag as TagIcon,
  FileText,
  FolderOpen,
  X,
  Grid3X3,
  Square,
  Download,
  Play,
  Pause,
  Copy,
  Check,
  FileDown,
  Upload,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react';

type Tab = 'generator' | 'history' | 'workflows';

export function VideoPanel() {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    params,
    setParams,
    isGenerating,
    setIsGenerating,
    videos,
    addVideo,
    clearVideos,
    selectedVideo,
    setSelectedVideo,
    history,
    clearHistory,
    removeFromHistory,
    starredIds,
    toggleStar,
    isStarred,
    videoTags,
    addTagToVideo,
    removeTagFromVideo,
    getVideoTags,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    showStarsOnly,
    setShowStarsOnly,
    savedConfigs,
    saveConfig,
    deleteConfig,
    loadConfigIntoGenerator,
    promptTemplates,
    addPromptTemplate,
    deletePromptTemplate,
    density,
    setDensity,
    viewMode,
    setViewMode,
    lightboxZoom,
    setLightboxZoom,
    lightboxPan,
    setLightboxPan,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    selectedResult,
    setSelectedResult,
  } = useVideoStore();

  const { selectedModel, models, fetchModels } = useModelStore();
  const { executionMode } = useAppStore();

  const [tab, setTab] = useState<Tab>('generator');
  const [showParams, setShowParams] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [configName, setConfigName] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showHardwareWarning, setShowHardwareWarning] = useState(false);

  const lightboxRef = useRef<HTMLDivElement>(null);

  // Video presets for common configurations
  const VIDEO_PRESETS = [
    { name: 'Short Clip (16:9)', params: { width: 768, height: 512, frames: 16, fps: 20, steps: 15, cfgScale: 5 } },
    { name: 'Medium Clip (16:9)', params: { width: 1024, height: 576, frames: 32, fps: 24, steps: 20, cfgScale: 5 } },
    { name: 'Long Clip (16:9)', params: { width: 1024, height: 576, frames: 64, fps: 24, steps: 25, cfgScale: 5 } },
    { name: 'Square (1:1)', params: { width: 512, height: 512, frames: 16, fps: 20, steps: 15, cfgScale: 5 } },
    { name: 'Portrait (9:16)', params: { width: 512, height: 768, frames: 16, fps: 20, steps: 15, cfgScale: 5 } },
    { name: 'High Quality', params: { width: 1024, height: 576, frames: 16, fps: 30, steps: 30, cfgScale: 7 } },
  ];

  // Check if VRAM might be insufficient for the selected resolution
  useEffect(() => {
    const totalPixels = (params.width || 768) * (params.height || 512) * (params.frames || 16);
    // Rough heuristic: > 50M pixel-frames may cause OOM on 8GB VRAM
    if (totalPixels > 50_000_000) {
      setShowHardwareWarning(true);
    } else {
      setShowHardwareWarning(false);
    }
  }, [params.width, params.height, params.frames]);

  const videoModels = models.video as VideoModel[];
  const activeVideoModel = videoModels.find((model) => model.id === selectedModel.video);

  useEffect(() => {
    fetchModels('video');
  }, [fetchModels]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod && e.key === 'Escape') {
        if (selectedResult) setSelectedResult(null);
        else if (showSaveConfig) setShowSaveConfig(false);
        else if (showSaveTemplate) setShowSaveTemplate(false);
        else if (showTemplateMenu) setShowTemplateMenu(false);
        else if (showDensityMenu) setShowDensityMenu(false);
        return;
      }
      if (!isMod) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (tab === 'generator' && !isGenerating) handleGenerate();
      } else if (e.key === 's') {
        e.preventDefault();
        if (tab === 'generator' && videos.length > 0) setShowSaveConfig(true);
      } else if (e.key === '1') { e.preventDefault(); setTab('generator'); }
      else if (e.key === '2') { e.preventDefault(); setTab('history'); }
      else if (e.key === '3') { e.preventDefault(); setTab('workflows'); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isGenerating, tab, selectedResult, showSaveConfig, showSaveTemplate, showTemplateMenu, showDensityMenu, videos.length]);

  // Reset lightbox when closing
  useEffect(() => {
    if (!selectedResult) {
      setLightboxZoom(1);
      setLightboxPan({ x: 0, y: 0 });
    }
  }, [selectedResult]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating || !selectedModel.video) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/video/text-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.video,
          runtime: activeVideoModel?.runtime,
          prompt,
          params,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const nextVideo = {
          id: crypto.randomUUID(),
          url: data.data.videoFile as string,
          prompt,
          negativePrompt: negativePrompt || undefined,
          params: { ...params },
          modelId: selectedModel.video,
          timestamp: new Date(),
          duration: data.data.duration as number,
          frames: data.data.frames as number,
        };
        addVideo(nextVideo);
      } else {
        const errorMsg = data.error || 'Unknown video generation error';
        console.error('Video generation failed:', errorMsg);
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate video. Make sure ComfyUI is running.';
      console.error('Failed to generate video:', error);
      setErrorMessage(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadVideo = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download video:', error);
    }
  };

  const handleSelectTemplate = (template: { id: string; name: string; prompt: string; negativePrompt?: string }) => {
    setPrompt(template.prompt);
    setNegativePrompt(template.negativePrompt || '');
    setShowTemplateMenu(false);
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) return;
    addPromptTemplate(templateName.trim(), prompt, negativePrompt);
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleAddTag = () => {
    if (!selectedResult || !tagInput.trim()) return;
    addTagToVideo(selectedResult.data.id, tagInput.trim());
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedResult) return;
    removeTagFromVideo(selectedResult.data.id, tag);
  };

  const handleExportMetadata = () => {
    const targets = showStarsOnly
      ? history.filter((v) => isStarred(v.id))
      : history;
    if (targets.length === 0) return;
    const metadata = targets.map((v) => ({
      id: v.id,
      prompt: v.prompt,
      negativePrompt: v.negativePrompt,
      params: v.params,
      modelId: v.modelId,
      duration: v.duration,
      frames: v.frames,
      timestamp: v.timestamp,
      tags: getVideoTags(v.id),
      starred: isStarred(v.id),
    }));
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchDownload = async () => {
    const targets = showStarsOnly
      ? history.filter((v) => isStarred(v.id))
      : history;
    for (const v of targets) {
      await downloadVideo(v.url, `video-${v.id.slice(0, 8)}.mp4`);
    }
  };

  const filteredAndSortedHistory = (() => {
    let result = [...history];
    if (showStarsOnly) {
      result = result.filter((v) => isStarred(v.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) =>
        v.prompt.toLowerCase().includes(q) ||
        v.modelId.toLowerCase().includes(q) ||
        getVideoTags(v.id).some((t) => t.includes(q))
      );
    }
    result.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      switch (sortBy) {
        case 'oldest': return aTime - bTime;
        case 'duration-asc': return a.duration - b.duration;
        case 'duration-desc': return b.duration - a.duration;
        case 'frames-asc': return a.frames - b.frames;
        case 'frames-desc': return b.frames - a.frames;
        default: return bTime - aTime;
      }
    });
    return result;
  })();

  const getGridTemplateColumns = () => {
    switch (density) {
      case 'compact': return 'repeat(auto-fill, minmax(280px, 1fr))';
      case 'spacious': return 'repeat(auto-fill, minmax(400px, 1fr))';
      default: return 'repeat(auto-fill, minmax(340px, 1fr))';
    }
  };

  const historyCount = history.length;
  const configCount = savedConfigs.length;

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Video</h1>
          <p className="orch-view-subtitle">
            Text-to-video generation with Wan 2.2 via ComfyUI. Create clips from text prompts.
          </p>
        </div>
        <div className="orch-view-actions">
          {tab === 'generator' && (
            <>
              {videos.length > 0 && (
                <button className="orch-btn" onClick={() => setShowSaveConfig(true)}>
                  <Save size={14} />Save Config
                </button>
              )}
              <button className="orch-btn" onClick={() => setShowParams(!showParams)}>
                <Settings size={14} />Parameters
              </button>
            </>
          )}
        </div>
      </div>

      <div className="orch-subtabs">
        <SubTab active={tab === 'generator'} onClick={() => setTab('generator')}>Generator</SubTab>
        <SubTab active={tab === 'history'} onClick={() => setTab('history')}>History <span className="count">{historyCount}</span></SubTab>
        <SubTab active={tab === 'workflows'} onClick={() => setTab('workflows')}>Workflows <span className="count">{configCount}</span></SubTab>
      </div>

      {/* ===== GENERATOR TAB ===== */}
      {tab === 'generator' && (
        <div className="orch-grid" style={{ gridTemplateColumns: showParams ? '1fr 280px' : '1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Prompt Input */}
            <div className="orch-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Prompt</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {promptTemplates.length > 0 && (
                      <div style={{ position: 'relative' }}>
                        <button className="orch-btn xs ghost" onClick={() => setShowTemplateMenu(!showTemplateMenu)}>
                          <FolderOpen size={12} />Templates
                        </button>
                        {showTemplateMenu && (
                          <div style={{
                            position: 'absolute', top: '100%', right: 0, zIndex: 10, minWidth: 200,
                            background: 'var(--bg-1)', border: '1px solid var(--border-c)', borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: 4,
                          }}>
                            {promptTemplates.map((t) => (
                              <div
                                key={t.id}
                                className="orch-row"
                                style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4 }}
                                onClick={() => handleSelectTemplate(t)}
                              >
                                <span style={{ flex: 1 }}>{t.name}</span>
                                <button
                                  className="orch-icon-btn"
                                  style={{ color: 'var(--text-3)', width: 20, height: 20 }}
                                  onClick={(e) => { e.stopPropagation(); deletePromptTemplate(t.id); }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button className="orch-btn xs ghost" onClick={() => setShowSaveTemplate(true)} title="Save as template">
                      <FileText size={12} />Save
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                  style={{
                    width: '100%',
                    resize: 'none',
                    borderRadius: 8,
                    border: '1px solid var(--border-c)',
                    background: 'var(--bg-2)',
                    padding: '8px 12px',
                    fontSize: 13.5,
                    color: 'var(--text-1)',
                    outline: 'none',
                    minHeight: 60,
                    lineHeight: 1.5,
                  }}
                  rows={3}
                  disabled={isGenerating}
                />
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Negative prompt (what to avoid)..."
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    border: '1px solid var(--border-c)',
                    background: 'var(--bg-2)',
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text-1)',
                    outline: 'none',
                  }}
                  disabled={isGenerating}
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="orch-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Model: {activeVideoModel?.name || 'None'} • {executionMode}
                </span>
                <button
                  className="orch-btn primary"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || !selectedModel.video || isGenerating}
                >
                  {isGenerating ? (
                    <><RefreshCw size={16} className="animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles size={16} /> Generate Video</>
                  )}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="orch-card" style={{ padding: 12, border: '1px solid var(--red, #e74c3c)' }}>
                <p style={{ fontSize: 13, color: 'var(--red, #e74c3c)' }}>
                  <strong>Error:</strong> {errorMessage}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                  Make sure ComfyUI is running with the Wan video workflow dependencies installed.
                </p>
              </div>
            )}

            {/* Video Preview / Recent Clips */}
            <div className="orch-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="orch-card-header">
                <div className="orch-card-title"><Film size={14} />Recent Clips</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
                  <div style={{ position: 'relative' }}>
                    <button className={`orch-icon-btn${showDensityMenu ? ' active' : ''}`} title="Gallery density" onClick={() => setShowDensityMenu(!showDensityMenu)}>
                      <Grid3X3 size={14} />
                    </button>
                    {showDensityMenu && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, zIndex: 10, minWidth: 140,
                        background: 'var(--bg-1)', border: '1px solid var(--border-c)', borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: 4,
                      }}>
                        {(['compact', 'comfortable', 'spacious'] as Density[]).map((d) => (
                          <button
                            key={d}
                            className={`orch-btn xs${density === d ? '' : ' ghost'}`}
                            onClick={() => { setDensity(d); setShowDensityMenu(false); }}
                            style={{ width: '100%', justifyContent: 'flex-start' }}
                          >
                            {d === 'compact' ? 'Small' : d === 'spacious' ? 'Large' : 'Medium'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className={`orch-icon-btn${viewMode === 'grid' ? ' active' : ''}`}
                    title="Grid view"
                    onClick={() => setViewMode('grid')}
                  >
                    <Square size={14} />
                  </button>
                  <button
                    className="orch-btn xs ghost"
                    onClick={clearVideos}
                    style={{ color: 'var(--red)' }}
                  >
                    <Trash2 size={12} />Clear
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {videos.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
                    <Film size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No videos generated yet</p>
                    <p style={{ fontSize: 13 }}>Enter a prompt and generate your first clip.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: getGridTemplateColumns(), gap: density === 'compact' ? 6 : density === 'spacious' ? 14 : 10 }}>
                    {videos.map((video) => (
                      <div
                        key={video.id}
                        className="orch-row"
                        style={{
                          cursor: 'pointer',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          padding: 0,
                          overflow: 'hidden',
                          borderRadius: 8,
                          border: selectedVideo?.id === video.id ? '2px solid var(--accent)' : '1px solid var(--border-c)',
                        }}
                        onClick={() => setSelectedVideo(video)}
                      >
                        <div style={{ position: 'relative', paddingTop: '56.25%', background: 'var(--bg-3)' }}>
                          <video
                            src={video.url}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            muted
                            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                        </div>
                        <div style={{ padding: 10 }}>
                          <p style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {video.prompt}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-2)' }}>
                            <span>{video.duration.toFixed(1)}s</span>
                            <span>•</span>
                            <span>{video.frames}f</span>
                            <button
                              className="orch-icon-btn"
                              style={{ width: 24, height: 24, marginLeft: 'auto' }}
                              onClick={(e) => { e.stopPropagation(); toggleStar(video.id); }}
                            >
                              <Star size={12} fill={isStarred(video.id) ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* List view */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {videos.map((video) => (
                      <div
                        key={video.id}
                        className="orch-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedVideo(video)}
                      >
                        <div className="orch-row-icon">
                          <Film size={14} />
                        </div>
                        <div className="orch-row-main">
                          <div className="orch-row-title" style={{ fontSize: 13 }}>
                            {video.prompt.slice(0, 70)}{video.prompt.length > 70 ? '...' : ''}
                          </div>
                          <div className="orch-row-sub">
                            {video.duration.toFixed(1)}s • {video.frames} frames • {video.params.width}x{video.params.height}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); toggleStar(video.id); }}>
                            <Star size={12} fill={isStarred(video.id) ? 'currentColor' : 'none'} />
                          </button>
                          <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); downloadVideo(video.url, `video-${video.id.slice(0, 8)}.mp4`); }}>
                            <Download size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parameters Panel */}
          {showParams && (
            <div className="orch-card" style={{ height: 'fit-content' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">Parameters</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ position: 'relative' }}>
                    <button className="orch-btn xs ghost" onClick={() => setShowPresets(!showPresets)}>
                      <SlidersHorizontal size={12} />Presets
                    </button>
                    {showPresets && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, zIndex: 10, minWidth: 200,
                        background: 'var(--bg-1)', border: '1px solid var(--border-c)', borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: 4,
                      }}>
                        {VIDEO_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            className="orch-btn xs ghost"
                            onClick={() => { setParams(preset.params); setShowPresets(false); }}
                            style={{ width: '100%', justifyContent: 'flex-start' }}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="orch-btn xs ghost" onClick={() => setShowParams(false)}>
                    <X size={12} />Close
                  </button>
                </div>
              </div>

              {/* Hardware Warning */}
              {showHardwareWarning && (
                <div style={{
                  margin: '0 14px 8px', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)',
                  fontSize: 12, color: 'var(--amber)',
                }}>
                  <strong>⚠ Hardware Note:</strong> The current resolution ({params.width}x{params.height}, {params.frames}f) may exceed available VRAM on 8GB GPUs. Consider reducing frames or resolution.
                </div>
              )}

              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Width">
                  <select
                    className="orch-select"
                    value={params.width || 768}
                    onChange={(e) => setParams({ width: parseInt(e.target.value, 10) })}
                  >
                    <option value={512}>512</option>
                    <option value={768}>768</option>
                    <option value={1024}>1024</option>
                  </select>
                </Field>
                <Field label="Height">
                  <select
                    className="orch-select"
                    value={params.height || 512}
                    onChange={(e) => setParams({ height: parseInt(e.target.value, 10) })}
                  >
                    <option value={512}>512</option>
                    <option value={768}>768</option>
                    <option value={1024}>1024</option>
                  </select>
                </Field>
                <Field label={`Frames: ${params.frames || 16}`}>
                  <input
                    type="range"
                    min={8}
                    max={activeVideoModel?.maxFrames || 81}
                    value={params.frames || 16}
                    onChange={(e) => setParams({ frames: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label={`FPS: ${params.fps || 20}`}>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    value={params.fps || 20}
                    onChange={(e) => setParams({ fps: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label={`Steps: ${params.steps || 15}`}>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={params.steps || 15}
                    onChange={(e) => setParams({ steps: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label={`CFG Scale: ${params.cfgScale || 5}`}>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={0.5}
                    value={params.cfgScale || 5}
                    onChange={(e) => setParams({ cfgScale: parseFloat(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label="Seed">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="orch-input"
                      type="number"
                      value={params.seed ?? ''}
                      onChange={(e) => setParams({ seed: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Random"
                    />
                    <button className="orch-btn xs ghost" onClick={() => setParams({ seed: Math.floor(Math.random() * 2147483647) })}>Random</button>
                  </div>
                </Field>

                <button className="orch-btn xs ghost" onClick={() => setShowParams(false)} style={{ marginTop: 4 }}>
                  <SlidersHorizontal size={12} />Hide Advanced
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === 'history' && (
        <div className="orch-grid" style={{ gridTemplateColumns: selectedResult ? '1fr 320px' : '1fr', gap: 14 }}>
          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title"><Film size={14} />Video History</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {history.some((v) => isStarred(v.id)) && (
                  <button
                    className={`orch-btn xs ${showStarsOnly ? '' : ' ghost'}`}
                    onClick={() => setShowStarsOnly(!showStarsOnly)}
                  >
                    <Star size={12} />Starred
                  </button>
                )}
                {history.length > 0 && (
                  <>
                    <button className="orch-btn xs ghost" onClick={handleBatchDownload}>
                      <Download size={12} />Batch
                    </button>
                    <button className="orch-btn xs ghost" onClick={handleExportMetadata}>
                      <FileDown size={12} />
                    </button>
                    <button className="orch-btn xs ghost" onClick={() => { clearHistory(); setSelectedResult(null); }}>
                      <Trash2 size={12} />Clear All
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search and Sort */}
            {history.length > 0 && (
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-c)', display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }} />
                  <input
                    className="orch-input"
                    style={{ paddingLeft: 28, width: '100%' }}
                    placeholder="Search by prompt, model, or tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpDown size={12} style={{ color: 'var(--text-2)' }} />
                  <select className="orch-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="duration-asc">Duration ↑</option>
                    <option value="duration-desc">Duration ↓</option>
                    <option value="frames-asc">Frames ↑</option>
                    <option value="frames-desc">Frames ↓</option>
                  </select>
                </div>
              </div>
            )}

            <div className="orch-list">
              {filteredAndSortedHistory.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
                  {searchQuery ? 'No videos match your search.' : 'No video history yet. Go to the Generator tab to create some.'}
                </div>
              ) : filteredAndSortedHistory.map((video) => (
                <div
                  className={`orch-row${selectedResult?.data.id === video.id ? ' active' : ''}`}
                  key={video.id}
                  onClick={() => setSelectedResult({ type: 'video', data: video })}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-3)', position: 'relative' }}>
                    <video
                      src={video.url}
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                  </div>
                  <div className="orch-row-main">
                    <div className="orch-row-title" style={{ fontSize: 13 }}>
                      {video.prompt.slice(0, 60)}{video.prompt.length > 60 ? '...' : ''}
                    </div>
                    <div className="orch-row-sub">
                      {video.duration.toFixed(1)}s • {video.frames} frames • {video.params.width}x{video.params.height}
                    </div>
                    {getVideoTags(video.id).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {getVideoTags(video.id).map((tag) => (
                          <span key={tag} className="orch-chip" style={{ fontSize: 10 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="orch-row-meta" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(video.timestamp).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); toggleStar(video.id); }}>
                      <Star size={12} fill={isStarred(video.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); downloadVideo(video.url, `video-${video.id.slice(0, 8)}.mp4`); }}>
                      <Download size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedResult && (
            <div className="orch-card" style={{ height: 'fit-content' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">Video Details</div>
              </div>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--bg-3)' }}>
                  <video
                    src={selectedResult.data.url}
                    controls
                    style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }}
                  />
                </div>
                <Field label="Prompt">
                  <textarea className="orch-textarea" rows={3} value={selectedResult.data.prompt} readOnly />
                </Field>
                {selectedResult.data.negativePrompt && (
                  <Field label="Negative Prompt">
                    <textarea className="orch-textarea" rows={2} value={selectedResult.data.negativePrompt} readOnly />
                  </Field>
                )}
                <Field label="Duration">
                  <input className="orch-input" value={`${selectedResult.data.duration.toFixed(1)}s`} readOnly />
                </Field>
                <Field label="Frames">
                  <input className="orch-input" value={`${selectedResult.data.frames} frames`} readOnly />
                </Field>
                <Field label="Resolution">
                  <input className="orch-input" value={`${selectedResult.data.params.width} x ${selectedResult.data.params.height}`} readOnly />
                </Field>
                <Field label="FPS / Steps / CFG">
                  <input className="orch-input" value={`${selectedResult.data.params.fps} fps • ${selectedResult.data.params.steps} steps • CFG ${selectedResult.data.params.cfgScale}`} readOnly />
                </Field>
                <Field label="Model">
                  <input className="orch-input" value={selectedResult.data.modelId} readOnly />
                </Field>

                {/* Tags */}
                <Field label="Tags">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {getVideoTags(selectedResult.data.id).map((tag) => (
                      <span key={tag} className="orch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
                        {tag}
                        <button
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                          onClick={() => handleRemoveTag(tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      className="orch-input"
                      style={{ flex: 1 }}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add tag..."
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                    />
                    <button className="orch-btn xs" onClick={handleAddTag}><TagIcon size={12} /></button>
                  </div>
                </Field>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="orch-btn primary" style={{ flex: 1 }}
                    onClick={() => {
                      copyToClipboard(selectedResult.data.prompt, selectedResult.data.id, setCopiedId);
                    }}
                  >
                    <Copy size={14} />Copy Prompt
                  </button>
                  <button className="orch-btn" onClick={() => downloadVideo(selectedResult.data.url, `video-${selectedResult.data.id.slice(0, 8)}.mp4`)}>
                    <Download size={14} />
                  </button>
                  <button
                    className="orch-btn"
                    onClick={() => {
                      removeFromHistory(selectedResult.data.id);
                      setSelectedResult(null);
                    }}
                    style={{ color: 'var(--red)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== WORKFLOWS TAB ===== */}
      {tab === 'workflows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Saved Configs */}
          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title"><Save size={14} />Saved Configs</div>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{configCount} config{configCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="orch-list">
              {configCount === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
                  No saved configs yet. Generate a video and click "Save Config" to save one.
                </div>
              )}
              {savedConfigs.map((cfg) => (
                <div className="orch-row" key={cfg.id}>
                  <div className="orch-row-icon"><Save size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">
                      {cfg.name}
                      <span className="orch-chip purple" style={{ marginLeft: 6 }}>Video</span>
                    </div>
                    <div className="orch-row-sub">
                      {cfg.params.width}x{cfg.params.height} • {cfg.params.frames}f • {cfg.params.fps}fps
                    </div>
                  </div>
                  <button
                    className="orch-btn xs"
                    onClick={() => {
                      loadConfigIntoGenerator(cfg);
                      setTab('generator');
                    }}
                  >
                    <Copy size={12} />Load
                  </button>
                  <button className="orch-icon-btn" title="Delete" onClick={() => deleteConfig(cfg.id)} style={{ color: 'var(--text-3)' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt Templates */}
          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title"><FileText size={14} />Prompt Templates</div>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{promptTemplates.length} template{promptTemplates.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="orch-list">
              {promptTemplates.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
                  No prompt templates saved yet. Save prompts from the Generator tab.
                </div>
              )}
              {promptTemplates.map((t) => (
                <div className="orch-row" key={t.id}>
                  <div className="orch-row-icon"><FileText size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">{t.name}</div>
                    <div className="orch-row-sub">{t.prompt.slice(0, 80)}{t.prompt.length > 80 ? '...' : ''}</div>
                  </div>
                  <button
                    className="orch-btn xs"
                    onClick={() => {
                      setPrompt(t.prompt);
                      setNegativePrompt(t.negativePrompt || '');
                      setTab('generator');
                    }}
                  >
                    <Copy size={12} />Load
                  </button>
                  <button className="orch-icon-btn" title="Delete" onClick={() => deletePromptTemplate(t.id)} style={{ color: 'var(--text-3)' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Save Config Dialog ===== */}
      {showSaveConfig && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 360 }}>
            <div className="orch-card-header">
              <div className="orch-card-title">Save Video Config</div>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Config name">
                <input
                  className="orch-input"
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="e.g. My Wan preset"
                  autoFocus
                />
              </Field>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <strong>Video</strong> • {params.width}x{params.height} • {params.frames}f • {params.fps}fps
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="orch-btn" onClick={() => { setShowSaveConfig(false); setConfigName(''); }}>Cancel</button>
                <button
                  className="orch-btn primary"
                  onClick={() => {
                    saveConfig(
                      configName || `Config ${configCount + 1}`,
                      prompt,
                      negativePrompt,
                      params,
                      selectedModel.video || '',
                    );
                    setShowSaveConfig(false);
                    setConfigName('');
                  }}
                  disabled={!configName.trim()}
                >
                  <Save size={14} />Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Save Template Dialog ===== */}
      {showSaveTemplate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 360 }}>
            <div className="orch-card-header">
              <div className="orch-card-title">Save Prompt Template</div>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Template name">
                <input
                  className="orch-input"
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Cinematic drone shot"
                  autoFocus
                />
              </Field>
              <Field label="Prompt">
                <textarea className="orch-textarea" rows={3} value={prompt} readOnly />
              </Field>
              {negativePrompt && (
                <Field label="Negative Prompt">
                  <textarea className="orch-textarea" rows={2} value={negativePrompt} readOnly />
                </Field>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="orch-btn" onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}>Cancel</button>
                <button
                  className="orch-btn primary"
                  onClick={handleSaveAsTemplate}
                  disabled={!templateName.trim()}
                >
                  <Save size={14} />Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Detail Modal ===== */}
      {selectedResult && tab === 'generator' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div
            style={{
              maxWidth: 800, maxHeight: '95vh',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orch-card" style={{ flexShrink: 0 }}>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, lineHeight: 1.5 }}>{selectedResult.data.prompt}</p>
                  </div>
                  <button className="orch-btn xs" onClick={() => toggleStar(selectedResult.data.id)}>
                    <Star size={12} fill={isStarred(selectedResult.data.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <video
                  src={selectedResult.data.url}
                  controls
                  style={{ width: '100%', maxHeight: 400, borderRadius: 8, background: 'black' }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {selectedResult.data.duration.toFixed(1)}s • {selectedResult.data.frames} frames • {selectedResult.data.params.width}x{selectedResult.data.params.height} • {selectedResult.data.params.fps}fps
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="orch-btn xs" onClick={() => copyToClipboard(selectedResult.data.prompt, selectedResult.data.id, setCopiedId)}>
                    {copiedId === selectedResult.data.id ? <Check size={12} /> : <Copy size={12} />} Copy Prompt
                  </button>
                  <button className="orch-btn xs" onClick={() => downloadVideo(selectedResult.data.url, `video-${selectedResult.data.id.slice(0, 8)}.mp4`)}>
                    <Download size={12} />Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function copyToClipboard(value: string, id: string, setCopiedId: (id: string | null) => void) {
  navigator.clipboard.writeText(value);
  setCopiedId(id);
  setTimeout(() => setCopiedId(null), 2000);
}
