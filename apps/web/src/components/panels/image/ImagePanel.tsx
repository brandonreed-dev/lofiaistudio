import { useState, useRef, useEffect } from 'react';
import { useImageStore } from '@/stores/image';
import { useModelStore, useAppStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { Workflow as WorkflowType } from '@lofiaistudio/shared';
import { ReactFlowProvider } from '@xyflow/react';
// import '@xyflow/react/dist/style.css';
import { Image as ImageIcon, Sparkles, Settings, Upload, Download, ZoomIn, Grid3X3, Square, Trash2, RefreshCw, Save, Copy, Play, X, Workflow, FileText, FolderOpen, Star, SlidersHorizontal, Search, ArrowUpDown, Tag as TagIcon, FileDown, Move } from 'lucide-react';
import { Field, SubTab } from '../panelPrimitives';
import { ImageWorkflowEditor } from './ImageWorkflowEditor';
import { ASPECT_RATIO_PRESETS, PRESET_CONFIGS, type PromptTemplate, type SortOption, type Density } from '@/stores/image';

type Tab = 'generator' | 'history' | 'workflows';

export function ImagePanel() {
  const {
    params,
    setParams,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    mode,
    setMode,
    referenceImage,
    setReferenceImage,
    referenceImageFile,
    setReferenceImageFile,
    isGenerating,
    setIsGenerating,
    images,
    addImages,
    clearImages,
    selectedImage,
    setSelectedImage,
    viewMode,
    setViewMode,
    density,
    setDensity,
    savedConfigs,
    saveConfig,
    deleteConfig,
    loadConfigIntoGenerator,
    promptTemplates,
    addPromptTemplate,
    deletePromptTemplate,
    starredImageIds,
    toggleStar,
    isStarred,
    imageTags,
    addTagToImage,
    removeTagFromImage,
    getImageTags,
    selectedWorkflowId,
    setSelectedWorkflowId,
    workflowOverrides,
    setWorkflowOverrides,
    resetWorkflowOverrides,
    workflowPresets,
    addWorkflowPreset,
    deleteWorkflowPreset,
  } = useImageStore();

  const { selectedModel, fetchModels } = useModelStore();
  const { executionMode } = useAppStore();
  const { workflows, updateEntity, pushToast } = useOrchestrationStore();

  const [tab, setTab] = useState<Tab>('generator');
  const [showParams, setShowParams] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [showStarsOnly, setShowStarsOnly] = useState(false);
  const [configName, setConfigName] = useState('');
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<typeof images[number] | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [tagInput, setTagInput] = useState('');
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [workflowManifest, setWorkflowManifest] = useState<{
    parameterManifest: Array<{
      nodeId: string;
      nodeType: string;
      inputName: string;
      inputType: 'number' | 'string' | 'boolean' | 'select' | 'image';
      min?: number;
      max?: number;
      step?: number;
      default?: unknown;
      options?: string[];
    }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  // Workflow editor state
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null);
  const imageWorkflows = workflows.filter((wf) =>
    wf.nodes.some((n) => n.type === 'model.image')
  );

  useEffect(() => {
    if (selectedModel) {
      fetchModels('image');
    }
  }, [fetchModels, selectedModel]);

  // Lightbox zoom controls
  const handleLightboxWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setLightboxZoom((z) => Math.min(Math.max(z + delta, 0.5), 4));
  };

  const handleLightboxMouseDown = (e: React.MouseEvent) => {
    if (lightboxZoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - lightboxPan.x, y: e.clientY - lightboxPan.y });
    }
  };

  const handleLightboxMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setLightboxPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleLightboxMouseUp = () => setIsPanning(false);

  const resetLightboxView = () => {
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  };

  const densityLabel = density === 'compact' ? 'Compact' : density === 'spacious' ? 'Spacious' : 'Comfortable';

  // â”€â”€ Generate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleSelectWorkflow = async (wfId: string | null) => {
    setSelectedWorkflowId(wfId);
    setShowWorkflowSelector(false);
    resetWorkflowOverrides();
    setWorkflowManifest(null);
    if (wfId) {
      try {
        const res = await fetch(`/api/workflows/${wfId}/comfyui`);
        const data = await res.json();
        if (data.success) {
          setWorkflowManifest(data.data);
        }
      } catch {
        // manifest fetch failed, proceed without it
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating || !selectedModel.image) return;
    if (mode === 'image-to-image' && !referenceImage) {
      pushToast('Please upload a reference image for image-to-image mode');
      return;
    }
    setIsGenerating(true);
    try {
      if (selectedWorkflowId) {
        // Run via workflow runner
        const body: Record<string, unknown> = {
          trigger: 'manual',
          inputs: {
            prompt,
            negativePrompt: negativePrompt || null,
            params: { ...params },
            ...workflowOverrides,
          },
        };
        if (mode === 'image-to-image' && referenceImage) body.inputs = { ...body.inputs as Record<string, unknown>, referenceImage };
        const response = await fetch(`/api/workflows/${selectedWorkflowId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (data.success) {
          const run = data.data;
          if (run.output?.images) {
            const newImages = run.output.images.map((url: string, index: number) => ({
              id: crypto.randomUUID(),
              url,
              prompt,
              negativePrompt,
              params: { ...params },
              modelId: selectedModel.image!,
              timestamp: new Date(),
              seed: run.output.seeds?.[index],
            }));
            addImages(newImages);
          }
        } else {
          console.error('Workflow run failed:', data.error);
          pushToast(`Workflow run failed: ${data.error}`);
        }
      } else {
        // Direct generation
        const endpoint = mode === 'text-to-image' ? '/api/image/text-to-image' : '/api/image/image-to-image';
        const body: Record<string, unknown> = { modelId: selectedModel.image, prompt, negativePrompt: negativePrompt || null, params };
        if (mode === 'image-to-image' && referenceImage) body.referenceImage = referenceImage;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json();
        if (data.success) {
          const newImages = data.data.images.map((url: string, index: number) => ({
            id: crypto.randomUUID(),
            url,
            prompt,
            negativePrompt,
            params: { ...params },
            modelId: selectedModel.image!,
            timestamp: new Date(),
            seed: data.data.seeds?.[index],
          }));
          addImages(newImages);
        } else {
          console.error('Generation failed:', data.error);
          pushToast(`Generation failed: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      pushToast('Failed to generate image. Make sure ComfyUI is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
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
      console.error('Failed to download image:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod && e.key === 'Escape') {
        if (selectedImage) setSelectedImage(null);
        else if (showSaveConfig) setShowSaveConfig(false);
        else if (showSaveTemplate) setShowSaveTemplate(false);
        else if (showTemplateMenu) setShowTemplateMenu(false);
        else if (showDensityMenu) setShowDensityMenu(false);
        else if (selectedHistoryImage) setSelectedHistoryImage(null);
        return;
      }
      if (!isMod) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (tab === 'generator' && !isGenerating) handleGenerate();
      } else if (e.key === 's') {
        e.preventDefault();
        if (tab === 'generator' && images.length > 0) setShowSaveConfig(true);
      } else if (e.key === 'd') {
        e.preventDefault();
        if (selectedImage && tab === 'generator') downloadImage(selectedImage.url, `image-${selectedImage.id.slice(0, 8)}.png`);
      } else if (e.key === '1') { e.preventDefault(); setTab('generator'); }
      else if (e.key === '2') { e.preventDefault(); setTab('history'); }
      else if (e.key === '3') { e.preventDefault(); setTab('workflows'); }
      else if (e.key === 'Delete') {
        e.preventDefault();
        if (tab === 'history' && selectedHistoryImage) {
          setSelectedHistoryImage(null);
        } else if (tab === 'history') {
          clearImages();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isGenerating, tab, selectedImage, images.length, selectedHistoryImage, showSaveConfig, showSaveTemplate, showTemplateMenu, showDensityMenu, handleGenerate, downloadImage, setSelectedImage, setShowSaveConfig, setShowSaveTemplate, setShowTemplateMenu, setShowDensityMenu, setTab, setSelectedHistoryImage, clearImages]);

  // Register paste listener for reference image
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (mode !== 'image-to-image') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (event) => {
            setReferenceImage(event.target?.result as string);
            setReferenceImageFile(file);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [mode, setReferenceImage, setReferenceImageFile]);

  // Reset lightbox when closing
  useEffect(() => {
    if (!selectedImage) resetLightboxView();
  }, [selectedImage]);

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
      setReferenceImageFile(file);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReferenceImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
        setReferenceImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImageFile(null);
  };

  const handleAspectRatioSelect = (preset: { width: number; height: number }) => {
    setParams({ width: preset.width, height: preset.height });
  };

  const handleSelectTemplate = (template: PromptTemplate) => {
    setPrompt(template.prompt);
    setNegativePrompt(template.negativePrompt || '');
    setShowTemplateMenu(false);
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) return;
    addPromptTemplate({
      name: templateName.trim(),
      prompt: prompt,
      negativePrompt: negativePrompt || undefined,
    });
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleBatchDownload = async () => {
    const targets = showStarsOnly ? images.filter((img) => isStarred(img.id)) : images;
    if (targets.length === 0) return;
    for (const img of targets) {
      await downloadImage(img.url, `image-${img.id.slice(0, 8)}.png`);
    }
    pushToast(`Downloading ${targets.length} image${targets.length !== 1 ? 's' : ''}`);
  };

  const handleExportMetadata = () => {
    const targets = showStarsOnly ? images.filter((img) => isStarred(img.id)) : images;
    if (targets.length === 0) return;
    const metadata = targets.map((img) => ({
      id: img.id,
      prompt: img.prompt,
      negativePrompt: img.negativePrompt,
      params: img.params,
      modelId: img.modelId,
      seed: img.seed,
      timestamp: img.timestamp,
      tags: getImageTags(img.id),
      starred: isStarred(img.id),
    }));
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${targets.length} metadata records`);
  };

  const handleAddTag = () => {
    if (!selectedHistoryImage || !tagInput.trim()) return;
    addTagToImage(selectedHistoryImage.id, tagInput.trim());
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedHistoryImage) return;
    removeTagFromImage(selectedHistoryImage.id, tag);
  };

  const filteredAndSortedImages = (() => {
    let result = [...images];
    if (showStarsOnly) result = result.filter((img) => isStarred(img.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((img) =>
        img.prompt.toLowerCase().includes(q) ||
        img.modelId.toLowerCase().includes(q) ||
        getImageTags(img.id).some((t) => t.includes(q))
      );
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        case 'seed-asc': return (a.seed ?? 0) - (b.seed ?? 0);
        case 'seed-desc': return (b.seed ?? 0) - (a.seed ?? 0);
        case 'resolution-asc': return ((a.params.width ?? 0) * (a.params.height ?? 0)) - ((b.params.width ?? 0) * (b.params.height ?? 0));
        case 'resolution-desc': return ((b.params.width ?? 0) * (b.params.height ?? 0)) - ((a.params.width ?? 0) * (a.params.height ?? 0));
        case 'steps-asc': return (a.params.steps ?? 0) - (b.params.steps ?? 0);
        case 'steps-desc': return (b.params.steps ?? 0) - (a.params.steps ?? 0);
        default: return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });
    return result;
  })();

  const getGridTemplateColumns = () => {
    switch (density) {
      case 'compact': return 'repeat(auto-fill, minmax(120px, 1fr))';
      case 'spacious': return 'repeat(auto-fill, minmax(220px, 1fr))';
      default: return 'repeat(auto-fill, minmax(160px, 1fr))';
    }
  };



  const imageCount = images.length;
  const configCount = savedConfigs.length;

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Image</h1>
          <p className="orch-view-subtitle">
            Generate images with local models. Browse history, save configs, and edit image generation workflows.
          </p>
        </div>
        <div className="orch-view-actions">
          {tab === 'generator' && (
            <>
              {images.length > 0 && (
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
        <SubTab active={tab === 'history'} onClick={() => setTab('history')}>History <span className="count">{imageCount}</span></SubTab>
        <SubTab active={tab === 'workflows'} onClick={() => setTab('workflows')}>Workflows <span className="count">{imageWorkflows.length + configCount}</span></SubTab>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• GENERATOR TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'generator' && (
        <div className="orch-grid" style={{ gridTemplateColumns: showParams ? '1fr 280px' : '1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Workflow Selector */}
            <div className="orch-card" style={{ padding: '8px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Workflow:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    className="orch-btn xs"
                    onClick={() => setShowWorkflowSelector(!showWorkflowSelector)}
                    style={{ minWidth: 140, justifyContent: 'space-between' }}
                  >
                    <span>{selectedWorkflowId ? (workflows.find((w) => w.id === selectedWorkflowId)?.name ?? 'Unknown') : 'Default (Direct)'}</span>
                    <span style={{ fontSize: 10, marginLeft: 6 }}>▼</span>
                  </button>
                  {showWorkflowSelector && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 20, minWidth: 240,
                      background: 'var(--bg-1)', border: '1px solid var(--border-c)', borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: 4, marginTop: 4,
                    }}>
                      <div
                        className="orch-row"
                        style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4 }}
                        onClick={() => handleSelectWorkflow(null)}
                      >
                        <Workflow size={14} />
                        <span style={{ marginLeft: 6 }}>Default (Direct)</span>
                      </div>
                      {imageWorkflows.length === 0 && (
                        <div style={{ padding: '8px', fontSize: 12, color: 'var(--text-2)' }}>
                          No image workflows available
                        </div>
                      )}
                      {imageWorkflows.map((wf) => (
                        <div
                          key={wf.id}
                          className="orch-row"
                          style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4 }}
                          onClick={() => handleSelectWorkflow(wf.id)}
                        >
                          <Workflow size={14} />
                          <div style={{ marginLeft: 6, flex: 1 }}>
                            <div>{wf.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{wf.description.slice(0, 50)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedWorkflowId && (
                  <button className="orch-btn xs ghost" onClick={() => setTab('workflows')} title="Edit workflow">
                    <SlidersHorizontal size={12} />Edit
                  </button>
                )}
              </div>
            </div>

            {/* Aspect Ratio Presets */}
            <div className="orch-card" style={{ padding: '8px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Aspect Ratio:</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ASPECT_RATIO_PRESETS.map((preset) => {
                    const isActive = params.width === preset.width && params.height === preset.height;
                    return (
                      <button
                        key={preset.label}
                        className={`orch-btn xs${isActive ? '' : ' ghost'}`}
                        onClick={() => handleAspectRatioSelect(preset)}
                        title={`${preset.width}×${preset.height}`}
                        style={isActive ? { background: 'var(--accent)', color: '#fff' } : undefined}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="orch-card" style={{ padding: '8px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 1, background: 'var(--bg-3)', borderRadius: 8, padding: 2 }}>
                  <button
                    className={`orch-btn sm${mode === 'text-to-image' ? '' : ' ghost'}`}
                    onClick={() => setMode('text-to-image')}
                    style={mode === 'text-to-image' ? { background: 'var(--accent)', color: '#fff' } : undefined}
                  >
                    <Sparkles size={14} />Text to Image
                  </button>
                  <button
                    className={`orch-btn sm${mode === 'image-to-image' ? '' : ' ghost'}`}
                    onClick={() => setMode('image-to-image')}
                    style={mode === 'image-to-image' ? { background: 'var(--accent)', color: '#fff' } : undefined}
                  >
                    <ImageIcon size={14} />Image to Image
                  </button>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
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
                </div>
              </div>
            </div>

            {/* Reference Image (for img2img) */}
            {mode === 'image-to-image' && (
              <div
                className="orch-card"
                style={{ padding: '10px 14px' }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleReferenceImageDrop}
              >
                {referenceImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={referenceImage} alt="Reference" style={{ height: 60, borderRadius: 6, objectFit: 'cover' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Reference image loaded</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button className="orch-btn xs ghost" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={12} />Replace
                      </button>
                      <button className="orch-btn xs ghost" onClick={removeReferenceImage} style={{ color: 'var(--red)' }}>
                        <X size={12} />Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <button className="orch-btn xs ghost" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={12} />Upload Reference Image
                    </button>
                    <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>
                      Drag & drop or paste from clipboard (Ctrl+V)
                    </p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReferenceImageUpload} />
              </div>
            )}

            {/* Image Gallery */}
            <div className="orch-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="orch-card-header">
                <div className="orch-card-title"><ImageIcon size={14} />Results</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {images.some((img) => isStarred(img.id)) && (
                    <button
                      className={`orch-btn xs ${showStarsOnly ? '' : ' ghost'}`}
                      onClick={() => setShowStarsOnly(!showStarsOnly)}
                      title="Show starred only"
                    >
                      <Star size={12} />Starred
                    </button>
                  )}
                  {images.length > 0 && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {showStarsOnly ? `${images.filter((img) => isStarred(img.id)).length} starred` : `${images.length} image${images.length !== 1 ? 's' : ''}`}
                      </span>
                      <button className="orch-btn xs ghost" onClick={handleBatchDownload}>
                        <Download size={12} />Batch
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {images.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
                    <ImageIcon size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No images generated yet</p>
                    <p style={{ fontSize: 13 }}>Enter a prompt and click Generate</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: getGridTemplateColumns(), gap: density === 'compact' ? 6 : density === 'spacious' ? 14 : 10 }}>
                    {(showStarsOnly ? images.filter((img) => isStarred(img.id)) : images).map((image) => (
                      <div
                        key={image.id}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '1px solid var(--border-c)',
                          background: 'var(--bg-3)',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        onClick={() => setSelectedImage(image)}
                        onMouseEnter={(e) => { (e.currentTarget.querySelector('.overlay') as HTMLElement).style.opacity = '1'; }}
                        onMouseLeave={(e) => { (e.currentTarget.querySelector('.overlay') as HTMLElement).style.opacity = '0'; }}
                      >
                        <img src={image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div
                          className="overlay"
                          style={{
                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: 0, transition: 'opacity 0.15s',
                          }}
                        >
                          <button className="orch-icon-btn" style={{ background: 'rgba(255,255,255,0.2)', width: 30, height: 30 }} onClick={(e) => { e.stopPropagation(); toggleStar(image.id); }}>
                            <Star size={14} fill={isStarred(image.id) ? 'currentColor' : 'none'} />
                          </button>
                          <button className="orch-icon-btn" style={{ background: 'rgba(255,255,255,0.2)', width: 30, height: 30 }} onClick={(e) => { e.stopPropagation(); setSelectedImage(image); }}>
                            <ZoomIn size={14} />
                          </button>
                          <button className="orch-icon-btn" style={{ background: 'rgba(255,255,255,0.2)', width: 30, height: 30 }} onClick={(e) => { e.stopPropagation(); downloadImage(image.url, `image-${image.id.slice(0, 8)}.png`); }}>
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Single view */
                  <div style={{ textAlign: 'center' }}>
                    {selectedImage ? (
                      <div>
                        <img src={selectedImage.url} alt="" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: 8 }} />
                        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)' }}>
                          <p>{selectedImage.prompt}</p>
                          <p style={{ fontSize: 12, marginTop: 4 }}>
                            Seed: {selectedImage.seed ?? 'â€”'} &middot; Steps: {selectedImage.params.steps} &middot; CFG: {selectedImage.params.cfgScale}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-2)', padding: 32 }}>Select an image to view</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Template Selector */}
            {promptTemplates.length > 0 && (
              <div className="orch-card" style={{ padding: '8px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="orch-btn xs ghost" onClick={() => setShowTemplateMenu(!showTemplateMenu)}>
                    <FolderOpen size={12} />Templates
                  </button>
                  {showTemplateMenu && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 10, minWidth: 200,
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
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt & Input */}
            <div className="orch-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Prompt</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="orch-btn xs ghost"
                      onClick={() => setShowSaveTemplate(true)}
                      title="Save current prompt as template"
                    >
                      <FileText size={12} />Save
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
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
                    minHeight: 44,
                    lineHeight: 1.5,
                  }}
                  rows={2}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    Model: {selectedModel.image || 'None'} &middot; {params.width}&times;{params.height} &middot; {executionMode}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="orch-btn primary"
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || isGenerating || !selectedModel.image}
                    >
                      {isGenerating ? <><RefreshCw size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parameters Panel */}
          {(showParams || showAdvancedParams) && (
            <div className="orch-card" style={{ height: 'fit-content' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">Parameters</div>
                <button className="orch-btn xs ghost" onClick={() => { setShowParams(false); setShowAdvancedParams(false); }}>
                  <X size={12} />Close
                </button>
              </div>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Quick presets */}
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Presets</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {PRESET_CONFIGS.map((preset) => {
                      const isActive = params.steps === preset.params.steps && params.cfgScale === preset.params.cfgScale && params.sampler === preset.params.sampler;
                      return (
                        <button
                          key={preset.id}
                          className={`orch-btn xs${isActive ? '' : ' ghost'}`}
                          onClick={() => setParams(preset.params)}
                          title={preset.name}
                          style={isActive ? { background: 'var(--accent)', color: '#fff' } : undefined}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="Width">
                  <input
                    className="orch-input"
                    type="number"
                    min={64}
                    max={2048}
                    step={64}
                    value={params.width || 512}
                    onChange={(e) => setParams({ width: parseInt(e.target.value, 10) || 512 })}
                  />
                </Field>
                <Field label="Height">
                  <input
                    className="orch-input"
                    type="number"
                    min={64}
                    max={2048}
                    step={64}
                    value={params.height || 512}
                    onChange={(e) => setParams({ height: parseInt(e.target.value, 10) || 512 })}
                  />
                </Field>
                <Field label={`Steps: ${params.steps || 20}`}>
                  <input type="range" min={1} max={50} value={params.steps || 20} onChange={(e) => setParams({ steps: parseInt(e.target.value) })} style={{ width: '100%' }} />
                </Field>
                <Field label={`CFG Scale: ${params.cfgScale || 7.5}`}>
                  <input type="range" min={1} max={20} step={0.5} value={params.cfgScale || 7.5} onChange={(e) => setParams({ cfgScale: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                </Field>
                <Field label="Sampler">
                  <select className="orch-select" value={params.sampler || 'euler'} onChange={(e) => setParams({ sampler: e.target.value })}>
                    <option value="euler">Euler</option>
                    <option value="euler_a">Euler Ancestral</option>
                    <option value="dpmpp_2m">DPM++ 2M</option>
                    <option value="dpmpp_2m_sde">DPM++ 2M SDE</option>
                    <option value="ddim">DDIM</option>
                  </select>
                </Field>
                <Field label="Scheduler">
                  <select className="orch-select" value={params.scheduler || 'normal'} onChange={(e) => setParams({ scheduler: e.target.value })}>
                    <option value="normal">Normal</option>
                    <option value="karras">Karras</option>
                    <option value="exponential">Exponential</option>
                  </select>
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
                <Field label="Batch Size">
                  <select className="orch-select" value={params.batchSize || 1} onChange={(e) => setParams({ batchSize: parseInt(e.target.value) })}>
                    <option value={1}>1 image</option>
                    <option value={2}>2 images</option>
                    <option value={4}>4 images</option>
                  </select>
                </Field>

                <button className="orch-btn xs ghost" onClick={() => setShowAdvancedParams(!showAdvancedParams)} style={{ marginTop: 4 }}>
                  <SlidersHorizontal size={12} />{showAdvancedParams ? 'Hide' : 'Show'} Advanced
                </button>

                {showAdvancedParams && (
                  <>
                    <Field label={`Clip Skip: ${params.clipSkip ?? 1}`}>
                      <input type="range" min={1} max={12} value={params.clipSkip ?? 1} onChange={(e) => setParams({ clipSkip: parseInt(e.target.value) })} style={{ width: '100%' }} />
                    </Field>
                    <Field label="VAE">
                      <select className="orch-select" value={params.vae || 'auto'} onChange={(e) => setParams({ vae: e.target.value })}>
                        <option value="auto">Auto</option>
                        <option value="sdxl_vae">SDXL VAE</option>
                        <option value="vae-ft-mse">VAE-FT-MSE</option>
                      </select>
                    </Field>
                    <Field label={`Denoising Strength: ${params.denoisingStrength ?? params.strength ?? 0.75}`}>
                      <input type="range" min={0} max={1} step={0.05} value={params.denoisingStrength ?? params.strength ?? 0.75} onChange={(e) => setParams({ denoisingStrength: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                    </Field>
                    <Field label="Hires. Fix">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={!!params.hiresFix} onChange={(e) => setParams({ hiresFix: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Enable upscaling pass</span>
                      </div>
                    </Field>
                    {params.hiresFix && (
                      <Field label="Hires Upscaler">
                        <select className="orch-select" value={params.hiresUpscaler || 'latent'} onChange={(e) => setParams({ hiresUpscaler: e.target.value })}>
                          <option value="latent">Latent</option>
                          <option value="esrgan">ESRGAN</option>
                          <option value="4x-ultrasharp">4x UltraSharp</option>
                        </select>
                      </Field>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• HISTORY TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'history' && (
        <div className="orch-grid" style={{ gridTemplateColumns: selectedHistoryImage ? '1fr 320px' : '1fr', gap: 14 }}>
          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title"><ImageIcon size={14} />Generated Images</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {images.some((img) => isStarred(img.id)) && (
                  <button
                    className={`orch-btn xs ${showStarsOnly ? '' : ' ghost'}`}
                    onClick={() => setShowStarsOnly(!showStarsOnly)}
                  >
                    <Star size={12} />Starred
                  </button>
                )}
                {images.length > 0 && (
                  <>
                    <button className="orch-btn xs ghost" onClick={handleBatchDownload}>
                      <Download size={12} />Batch
                    </button>
                    <button className="orch-btn xs ghost" onClick={handleExportMetadata}>
                      <FileDown size={12} />
                    </button>
                    <button className="orch-btn xs ghost" onClick={() => { clearImages(); setSelectedHistoryImage(null); }}>
                      <Trash2 size={12} />Clear All
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search and Sort */}
            {images.length > 0 && (
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
                    <option value="seed-asc">Seed ↑</option>
                    <option value="seed-desc">Seed ↓</option>
                    <option value="resolution-asc">Resolution ↑</option>
                    <option value="resolution-desc">Resolution ↓</option>
                    <option value="steps-asc">Steps ↑</option>
                    <option value="steps-desc">Steps ↓</option>
                  </select>
                </div>
              </div>
            )}

            <div className="orch-list">
              {filteredAndSortedImages.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
                  {searchQuery ? 'No images match your search.' : 'No images generated yet. Go to the Generator tab to create some.'}
                </div>
              ) : filteredAndSortedImages.map((img) => (
                <div
                  className={`orch-row${selectedHistoryImage?.id === img.id ? ' active' : ''}`}
                  key={img.id}
                  onClick={() => setSelectedHistoryImage(img)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-3)', position: 'relative' }}>
                    <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      className="orch-icon-btn"
                      style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, background: 'rgba(0,0,0,0.5)', padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); toggleStar(img.id); }}
                    >
                      <Star size={10} fill={isStarred(img.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="orch-row-main">
                    <div className="orch-row-title" style={{ fontSize: 13 }}>
                      {img.prompt.slice(0, 60)}{img.prompt.length > 60 ? '...' : ''}
                    </div>
                  <div className="orch-row-sub">
                    {img.params.width}×{img.params.height} · Steps: {img.params.steps} · CFG: {img.params.cfgScale}
                    {img.seed != null && <> · Seed: {img.seed}</>}
                  </div>
                    {getImageTags(img.id).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {getImageTags(img.id).map((tag) => (
                          <span key={tag} className="orch-chip" style={{ fontSize: 10 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="orch-row-meta" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(img.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedHistoryImage && (
            <div className="orch-card" style={{ height: 'fit-content' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">Image Details</div>
              </div>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <img src={selectedHistoryImage.url} alt="" style={{ width: '100%', borderRadius: 8 }} />
                  <button
                    className="orch-icon-btn"
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)' }}
                    onClick={() => toggleStar(selectedHistoryImage.id)}
                  >
                    <Star size={14} fill={isStarred(selectedHistoryImage.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <Field label="Prompt">
                  <textarea className="orch-textarea" rows={3} value={selectedHistoryImage.prompt} readOnly />
                </Field>
                {selectedHistoryImage.negativePrompt && (
                  <Field label="Negative Prompt">
                    <textarea className="orch-textarea" rows={2} value={selectedHistoryImage.negativePrompt} readOnly />
                  </Field>
                )}
                <Field label="Dimensions">
                  <input className="orch-input" value={`${selectedHistoryImage.params.width} × ${selectedHistoryImage.params.height}`} readOnly />
                </Field>
                <Field label="Steps / CFG">
                  <input className="orch-input" value={`${selectedHistoryImage.params.steps} steps · CFG ${selectedHistoryImage.params.cfgScale}`} readOnly />
                </Field>
                <Field label="Sampler / Scheduler">
                  <input className="orch-input" value={`${selectedHistoryImage.params.sampler ?? 'euler'} · ${selectedHistoryImage.params.scheduler ?? 'normal'}`} readOnly />
                </Field>
                <Field label="Seed">
                  <input className="orch-input" value={String(selectedHistoryImage.seed ?? '—')} readOnly />
                </Field>
                <Field label="Model">
                  <input className="orch-input" value={selectedHistoryImage.modelId} readOnly />
                </Field>

                {/* Tags */}
                <Field label="Tags">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {getImageTags(selectedHistoryImage.id).map((tag) => (
                      <span key={tag} className="orch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
                        {tag}
                        <button
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                          onClick={() => handleRemoveTag(tag)}
                        >
                          Ã—
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
                      setPrompt(selectedHistoryImage.prompt);
                      setNegativePrompt(selectedHistoryImage.negativePrompt ?? '');
                      setMode('text-to-image');
                      setParams({
                        width: selectedHistoryImage.params.width,
                        height: selectedHistoryImage.params.height,
                        steps: selectedHistoryImage.params.steps,
                        cfgScale: selectedHistoryImage.params.cfgScale,
                        sampler: selectedHistoryImage.params.sampler,
                        scheduler: selectedHistoryImage.params.scheduler,
                        seed: selectedHistoryImage.seed,
                        batchSize: selectedHistoryImage.params.batchSize,
                      });
                      setShowParams(false);
                      setSelectedHistoryImage(null);
                      setTab('generator');
                      pushToast('Loaded image config into generator');
                    }}
                  >
                    <Copy size={14} />Load Config
                  </button>
                  <button className="orch-btn" onClick={() => downloadImage(selectedHistoryImage.url, `image-${selectedHistoryImage.id.slice(0, 8)}.png`)}>
                    <Download size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• WORKFLOWS TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                  No saved configs yet. Generate an image and click "Save Config" to save one.
                </div>
              )}
              {savedConfigs.map((cfg) => (
                <div className="orch-row" key={cfg.id}>
                  <div className="orch-row-icon"><Save size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">
                      {cfg.name}
                      <span className="orch-chip purple" style={{ marginLeft: 6 }}>{cfg.mode === 'text-to-image' ? 'T2I' : 'I2I'}</span>
                    </div>
                    <div className="orch-row-sub">
                      {cfg.params.width}×{cfg.params.height} · Steps: {cfg.params.steps} · CFG: {cfg.params.cfgScale}
                      {cfg.params.seed != null && <> · Seed: {cfg.params.seed}</>}
                    </div>
                  </div>
                  <button
                    className="orch-btn xs"
                    onClick={() => {
                      loadConfigIntoGenerator(cfg);
                      setTab('generator');
                      pushToast(`Loaded config: ${cfg.name}`);
                    }}
                  >
                    <Copy size={12} />Load
                  </button>
                  <button className="orch-icon-btn" title="Delete" onClick={() => deleteConfig(cfg.id)} style={{ color: 'var(--text-3)' }}>
                    âœ•
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Image Workflows */}
          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title"><Workflow size={14} />Image Workflows</div>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{imageWorkflows.length} workflow{imageWorkflows.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="orch-list">
              {imageWorkflows.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
                  No workflows contain image generation nodes. Create one in the Workflows panel.
                </div>
              )}
              {imageWorkflows.map((wf) => (
                <div className="orch-row" key={wf.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedWfId(selectedWfId === wf.id ? null : wf.id)}>
                  <div className="orch-row-icon"><Workflow size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">{wf.name}</div>
                    <div className="orch-row-sub">{wf.description.slice(0, 80)}</div>
                  </div>
                  <button className="orch-btn xs" onClick={(e) => { e.stopPropagation(); setSelectedWfId(selectedWfId === wf.id ? null : wf.id); }}>
                    {selectedWfId === wf.id ? 'Hide' : 'Edit'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Editor (shown when a workflow is selected) */}
          {selectedWfId && (() => {
            const wf = workflows.find((w) => w.id === selectedWfId);
            if (!wf) return null;
            return (
              <div className="orch-card" style={{ overflow: 'hidden' }}>
                <div className="orch-card-header">
                  <div className="orch-card-title"><Workflow size={14} />{wf.name}</div>
                  <button className="orch-btn xs ghost" onClick={() => setSelectedWfId(null)}>
                    <X size={12} />Close
                  </button>
                </div>
                <ReactFlowProvider>
                  <ImageWorkflowEditor workflow={wf} onSave={(c, id, p) => updateEntity(c as any, id, p)} />
                </ReactFlowProvider>
              </div>
            );
          })()}
        </div>
      )}

      {/* â”€â”€ Save Config Dialog â”€â”€ */}
      {showSaveConfig && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 360 }}>
            <div className="orch-card-header">
              <div className="orch-card-title">Save Generation Config</div>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Config name">
                <input
                  className="orch-input"
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="e.g. My SDXL portrait style"
                  autoFocus
                />
              </Field>
              <Field label="Prompt">
                <textarea className="orch-textarea" rows={2} value={prompt} readOnly />
              </Field>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <strong>{mode === 'text-to-image' ? 'T2I' : 'I2I'}</strong> &middot; {params.width}&times;{params.height} &middot; Steps: {params.steps} &middot; CFG: {params.cfgScale}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="orch-btn" onClick={() => { setShowSaveConfig(false); setConfigName(''); }}>Cancel</button>
                <button
                  className="orch-btn primary"
                  onClick={() => {
                    saveConfig(configName || `Config ${configCount + 1}`, prompt, negativePrompt, mode, params);
                    setShowSaveConfig(false);
                    setConfigName('');
                    pushToast('Config saved');
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

      {/* â”€â”€ Save Template Dialog â”€â”€ */}
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
                  placeholder="e.g. Cyberpunk portrait"
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

      {/* â”€â”€ Image Detail Modal (from Generator grid) â”€â”€ */}
      {selectedImage && tab === 'generator' && viewMode === 'grid' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            ref={lightboxRef}
            style={{
              maxWidth: 900, maxHeight: '95vh',
              cursor: lightboxZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleLightboxWheel}
            onMouseDown={handleLightboxMouseDown}
            onMouseMove={handleLightboxMouseMove}
            onMouseUp={handleLightboxMouseUp}
            onMouseLeave={handleLightboxMouseUp}
          >
            <div style={{ overflow: 'auto', maxHeight: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={selectedImage.url}
                alt=""
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: 8,
                  transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
                  transition: isPanning ? 'none' : 'transform 0.2s',
                  cursor: lightboxZoom > 1 ? 'grab' : 'default',
                }}
                draggable={false}
              />
            </div>
            <div className="orch-card" style={{ marginTop: 12, flexShrink: 0 }}>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13 }}>{selectedImage.prompt}</p>
                    {selectedImage.negativePrompt && (
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Negative: {selectedImage.negativePrompt}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button className="orch-btn xs ghost" onClick={() => setLightboxZoom((z) => Math.max(z - 0.3, 0.5))} title="Zoom out">
                        <ZoomIn size={12} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                      <span style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 40, textAlign: 'center' }}>{Math.round(lightboxZoom * 100)}%</span>
                      <button className="orch-btn xs ghost" onClick={() => setLightboxZoom((z) => Math.min(z + 0.3, 4))} title="Zoom in">
                        <ZoomIn size={12} />
                      </button>
                      <button className="orch-btn xs ghost" onClick={resetLightboxView} title="Reset view">
                        <Move size={12} />
                      </button>
                    </div>
                    <button className="orch-btn xs" onClick={() => toggleStar(selectedImage.id)}>
                      <Star size={12} fill={isStarred(selectedImage.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button className="orch-btn xs" onClick={() => downloadImage(selectedImage.url, `image-${selectedImage.id.slice(0, 8)}.png`)}>
                      <Download size={12} />Download
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Seed: {selectedImage.seed ?? '—'} · Steps: {selectedImage.params.steps} · CFG: {selectedImage.params.cfgScale}
                  · {selectedImage.params.width}×{selectedImage.params.height}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
