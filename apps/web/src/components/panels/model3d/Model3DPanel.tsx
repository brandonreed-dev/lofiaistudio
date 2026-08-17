import { useState, useRef } from 'react';
import { useModel3DStore, MODEL3D_PRESET_CONFIGS } from '@/stores/model3d';
import { useModelStore, useAppStore } from '@/stores';
import { Box, Sparkles, Settings, Upload, Download, Trash2, Save, X, Star, SlidersHorizontal, FileDown } from 'lucide-react';
import { Field, SubTab } from '../panelPrimitives';

type Tab = 'generator' | 'history';

export function Model3DPanel() {
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
    models,
    addModels,
    clearModels,
    selectedModel,
    setSelectedModel,
    viewMode,
    setViewMode,
    savedConfigs,
    saveConfig,
    deleteConfig,
    loadConfigIntoGenerator,
    starredModelIds,
    toggleStar,
    isStarred,
  } = useModel3DStore();

  const { models: availableModels, fetchModels } = useModelStore();
  const { executionMode } = useAppStore();

  const [tab, setTab] = useState<Tab>('generator');
  const [showParams, setShowParams] = useState(false);
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [configName, setConfigName] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const model3DList = availableModels['3d'] ?? [];

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!selectedModelId) {
      alert('Please select a 3D model first.');
      return;
    }

    setIsGenerating(true);
    try {
      const endpoint = mode === 'image-to-3d' ? '/api/3d/image-to-3d' : '/api/3d/text-to-3d';
      const body: Record<string, unknown> = {
        modelId: selectedModelId,
        prompt,
        negativePrompt: negativePrompt || null,
        params,
      };
      if (mode === 'image-to-3d' && referenceImage) {
        body.referenceImage = referenceImage;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Generation failed');

      const result = json.data as { modelFiles: string[]; seeds: number[] };
      const newModels = result.modelFiles.map((url, i) => ({
        id: crypto.randomUUID(),
        url,
        prompt,
        negativePrompt: negativePrompt || undefined,
        params: { ...params },
        modelId: selectedModelId,
        timestamp: new Date(),
        seed: result.seeds[i],
      }));
      addModels(newModels);
      setSelectedModel(newModels[0] ?? null);
    } catch (err) {
      console.error('3D generation failed:', err);
      alert(err instanceof Error ? err.message : '3D generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
      setReferenceImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveConfig = () => {
    if (!configName.trim()) return;
    saveConfig(configName, prompt, negativePrompt, mode, params);
    setConfigName('');
    setShowSaveConfig(false);
  };

  const densityClass =
    params.textureResolution && params.textureResolution >= 2048
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="orch-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">3D Model Generation</h2>
        </div>
        <div className="flex items-center gap-2">
          <SubTab active={tab === 'generator'} onClick={() => setTab('generator')}>Generator</SubTab>
          <SubTab active={tab === 'history'} onClick={() => setTab('history')}>History</SubTab>
        </div>
      </div>

      {tab === 'generator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          {/* Left: Controls */}
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('text-to-3d')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === 'text-to-3d' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                Text to 3D
              </button>
              <button
                onClick={() => setMode('image-to-3d')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === 'image-to-3d' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                Image to 3D
              </button>
            </div>

            {/* Model selector */}
            <Field label="3D Model">
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Select a 3D model...</option>
                {model3DList.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {model3DList.length === 0 && (
                <p className="text-xs text-zinc-500 mt-1">
                  No 3D models detected. Install a 3D generation custom node pack (e.g. Trellis, Hunyuan3D) in ComfyUI.
                </p>
              )}
            </Field>

            {/* Prompt */}
            <Field label="Prompt">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the 3D object you want to generate..."
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </Field>

            <Field label="Negative Prompt">
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </Field>

            {/* Image-to-3D reference */}
            {mode === 'image-to-3d' && (
              <Field label="Reference Image">
                <div className="flex items-center gap-3">
                  {referenceImage ? (
                    <div className="relative">
                      <img src={referenceImage} alt="Reference" className="w-24 h-24 object-cover rounded-md border border-zinc-700" />
                      <button
                        onClick={() => { setReferenceImage(null); setReferenceImageFile(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 hover:bg-zinc-700"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </div>
              </Field>
            )}

            {/* Params */}
            <div className="border border-zinc-800 rounded-md">
              <button
                onClick={() => setShowParams(!showParams)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/50"
              >
                <span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Parameters</span>
                <span>{showParams ? '−' : '+'}</span>
              </button>
              {showParams && (
                <div className="p-3 space-y-3 border-t border-zinc-800">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Steps">
                      <input
                        type="number"
                        value={params.steps ?? 25}
                        onChange={(e) => setParams({ steps: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200"
                      />
                    </Field>
                    <Field label="CFG Scale">
                      <input
                        type="number"
                        step="0.5"
                        value={params.cfgScale ?? 7.5}
                        onChange={(e) => setParams({ cfgScale: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200"
                      />
                    </Field>
                    <Field label="Format">
                      <select
                        value={params.format ?? 'glb'}
                        onChange={(e) => setParams({ format: e.target.value as 'glb' | 'obj' | 'ply' | 'splat' })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200"
                      >
                        <option value="glb">GLB</option>
                        <option value="obj">OBJ</option>
                        <option value="ply">PLY</option>
                        <option value="splat">Splat</option>
                      </select>
                    </Field>
                    <Field label="Texture Resolution">
                      <select
                        value={params.textureResolution ?? 1024}
                        onChange={(e) => setParams({ textureResolution: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200"
                      >
                        <option value={512}>512</option>
                        <option value={1024}>1024</option>
                        <option value={2048}>2048</option>
                      </select>
                    </Field>
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap gap-2">
                    {MODEL3D_PRESET_CONFIGS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setParams(preset.params)}
                        className="px-2 py-1 rounded-md text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || !selectedModelId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate 3D Model'}
            </button>

            {/* Save config */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveConfig(!showSaveConfig)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 hover:bg-zinc-700"
              >
                <Save className="w-4 h-4" /> Save Config
              </button>
              {showSaveConfig && (
                <div className="flex items-center gap-2">
                  <input
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="Config name"
                    className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200"
                  />
                  <button onClick={handleSaveConfig} className="px-3 py-1.5 bg-orange-500 rounded-md text-sm text-white">Save</button>
                </div>
              )}
            </div>

            {/* Saved configs */}
            {savedConfigs.length > 0 && (
              <div className="border border-zinc-800 rounded-md">
                <div className="px-3 py-2 text-sm text-zinc-400 font-medium">Saved Configs</div>
                <div className="divide-y divide-zinc-800">
                  {savedConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between px-3 py-2">
                      <button
                        onClick={() => loadConfigIntoGenerator(config)}
                        className="text-sm text-zinc-300 hover:text-orange-300 text-left"
                      >
                        {config.name}
                      </button>
                      <button onClick={() => deleteConfig(config.id)} className="text-zinc-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Gallery */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-300">Generated Models ({models.length})</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'single' : 'grid')}
                  className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  {viewMode === 'grid' ? 'Single' : 'Grid'}
                </button>
                {models.length > 0 && (
                  <button onClick={clearModels} className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {models.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-md">
                <Box className="w-12 h-12 mb-2" />
                <p className="text-sm">No 3D models generated yet</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className={`grid ${densityClass} gap-3`}>
                {models.map((model) => (
                  <div key={model.id} className="border border-zinc-800 rounded-md overflow-hidden group">
                    <div className="aspect-square bg-zinc-900 flex items-center justify-center">
                      <Box className="w-12 h-12 text-zinc-600" />
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs text-zinc-300 truncate">{model.prompt}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500">{model.params.format ?? 'glb'}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleStar(model.id)}
                            className={`p-1 rounded ${isStarred(model.id) ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={model.url}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-zinc-500 hover:text-zinc-300"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedModel ? (
              <div className="border border-zinc-800 rounded-md overflow-hidden">
                <div className="aspect-square bg-zinc-900 flex items-center justify-center">
                  <Box className="w-24 h-24 text-zinc-600" />
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm text-zinc-200">{selectedModel.prompt}</p>
                  <p className="text-xs text-zinc-500">Format: {selectedModel.params.format ?? 'glb'}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedModel.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-md text-sm text-white"
                    >
                      <FileDown className="w-4 h-4" /> Download
                    </a>
                    <button
                      onClick={() => toggleStar(selectedModel.id)}
                      className={`p-2 rounded-md border ${isStarred(selectedModel.id) ? 'text-yellow-400 border-yellow-500/40' : 'text-zinc-400 border-zinc-700'}`}
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* History tab */
        <div className="p-4">
          {models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <Box className="w-12 h-12 mb-2" />
              <p className="text-sm">No generation history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between px-3 py-2 border border-zinc-800 rounded-md">
                  <div className="flex items-center gap-3">
                    <Box className="w-5 h-5 text-zinc-500" />
                    <div>
                      <p className="text-sm text-zinc-200 truncate max-w-md">{model.prompt}</p>
                      <p className="text-xs text-zinc-500">{model.timestamp.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedModel(model)} className="text-xs text-zinc-400 hover:text-orange-300">View</button>
                    <a href={model.url} download target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300">
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}