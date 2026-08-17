import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import type { AudioModel } from '@lofiaistudio/shared';
import { convertBlobToWav } from './audioEncoding';
import { useAudioStore, type AudioResult, type SortOption, type Density } from '@/stores/audio';
import { useModelStore, useAppStore } from '@/stores';
import { Field, SubTab } from '../panelPrimitives';
import {
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Download,
  Trash2,
  Settings,
  Volume2,
  FileAudio,
  RefreshCw,
  Copy,
  Check,
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
  ZoomIn,
  Move,
  FileDown,
  Workflow,
} from 'lucide-react';

type Tab = 'generator' | 'history' | 'workflows';

export function AudioPanel() {
  const {
    mode,
    setMode,
    selectedSttModel,
    setSelectedSttModel,
    selectedTtsModel,
    setSelectedTtsModel,
    audioFile,
    audioDataUrl,
    isRecording,
    setAudioFile,
    setAudioDataUrl,
    setIsRecording,
    text,
    setText,
    params,
    setParams,
    isProcessing,
    setIsProcessing,
    transcriptions,
    addTranscription,
    clearTranscriptions,
    syntheses,
    addSynthesis,
    clearSyntheses,
    history,
    clearHistory,
    removeFromHistory,
    starredIds,
    toggleStar,
    isStarred,
    imageTags,
    addTagToResult,
    removeTagFromResult,
    getResultTags,
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
    currentlyPlaying,
    setCurrentlyPlaying,
    selectedResult,
    setSelectedResult,
  } = useAudioStore();

  const { models, fetchModels } = useModelStore();
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
  const [density, setDensity] = useState<Density>('comfortable');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const audioModels = models.audio as AudioModel[];
  const sttModels = audioModels.filter((model) => model.type === 'stt');
  const ttsModels = audioModels.filter((model) => model.type === 'tts');
  const activeSttModel = sttModels.find((model) => model.id === selectedSttModel) ?? null;
  const activeTtsModel = ttsModels.find((model) => model.id === selectedTtsModel) ?? null;

  useEffect(() => {
    fetchModels('audio');
  }, [fetchModels]);

  useEffect(() => {
    if (!selectedSttModel && sttModels.length > 0) {
      setSelectedSttModel(sttModels[0].id);
    }
  }, [selectedSttModel, setSelectedSttModel, sttModels]);

  useEffect(() => {
    if (!selectedTtsModel && ttsModels.length > 0) {
      setSelectedTtsModel(ttsModels[0].id);
    }
  }, [selectedTtsModel, setSelectedTtsModel, ttsModels]);

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
        if (tab === 'generator' && !isProcessing) {
          if (mode === 'stt') handleTranscribe();
          else handleSynthesize();
        }
      } else if (e.key === 's') {
        e.preventDefault();
        if (tab === 'generator' && (transcriptions.length > 0 || syntheses.length > 0)) {
          setShowSaveConfig(true);
        }
      } else if (e.key === '1') { e.preventDefault(); setTab('generator'); }
      else if (e.key === '2') { e.preventDefault(); setTab('history'); }
      else if (e.key === '3') { e.preventDefault(); setTab('workflows'); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isProcessing, tab, mode, selectedResult, showSaveConfig, showSaveTemplate, showTemplateMenu, showDensityMenu]);

  // Reset lightbox when closing
  useEffect(() => {
    if (!selectedResult) {
      setLightboxZoom(1);
      setLightboxPan({ x: 0, y: 0 });
    }
  }, [selectedResult]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setAudioDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        try {
          const file = await convertBlobToWav(blob);
          const reader = new FileReader();

          reader.onload = (event) => {
            setAudioDataUrl(event.target?.result as string);
            setAudioFile(file);
          };

          reader.readAsDataURL(file);
        } catch (error) {
          console.error('Failed to convert recording to WAV:', error);
          setErrorMessage('Recorded audio could not be converted to WAV. Try uploading a WAV or MP3 file instead.');
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setErrorMessage('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audioDataUrl || isProcessing || !activeSttModel) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: activeSttModel.id,
          runtime: activeSttModel.runtime,
          audioData: audioDataUrl,
          params,
        }),
      });

      const data = await response.json();

      if (data.success) {
        addTranscription({
          id: crypto.randomUUID(),
          text: data.data.text,
          duration: data.data.duration,
          audioFileName: audioFile?.name || 'recording.wav',
          timestamp: new Date(),
          language: params.language,
        });
      } else {
        const errorMsg = data.error || 'Unknown transcription error';
        console.error('Transcription failed:', errorMsg);
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to transcribe audio';
      console.error('Failed to transcribe:', error);
      setErrorMessage(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSynthesize = async () => {
    if (!text.trim() || isProcessing || !activeTtsModel) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/audio/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: activeTtsModel.id,
          runtime: activeTtsModel.runtime,
          text,
          params,
        }),
      });

      const data = await response.json();

      if (data.success) {
        addSynthesis({
          id: crypto.randomUUID(),
          text,
          audioUrl: data.data.audioFile,
          duration: data.data.duration,
          timestamp: new Date(),
          voice: activeTtsModel.name,
        });
      } else {
        const errorMsg = data.error || 'Unknown synthesis error';
        console.error('Synthesis failed:', errorMsg);
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to synthesize speech';
      console.error('Failed to synthesize:', errorMsg);
      setErrorMessage(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlayback = (audioUrl: string, id: string) => {
    if (audioRef.current) {
      if (currentlyPlaying === id) {
        audioRef.current.pause();
        setCurrentlyPlaying(null);
      } else {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setCurrentlyPlaying(id);
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setCurrentlyPlaying(null);
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    }
  }, [setCurrentlyPlaying]);

  const copyToClipboard = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadAudio = (audioUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    a.click();
  };

  const clearAudio = () => {
    setAudioFile(null);
    setAudioDataUrl(null);
  };

  const handleSelectTemplate = (template: { id: string; name: string; text: string }) => {
    setText(template.text);
    setShowTemplateMenu(false);
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) return;
    addPromptTemplate(templateName.trim(), text);
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleAddTag = () => {
    if (!selectedResult || !tagInput.trim()) return;
    const id = selectedResult.type === 'transcription' ? selectedResult.data.id : selectedResult.data.id;
    addTagToResult(id, tagInput.trim());
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedResult) return;
    const id = selectedResult.type === 'transcription' ? selectedResult.data.id : selectedResult.data.id;
    removeTagFromResult(id, tag);
  };

  const handleExportMetadata = () => {
    const targets = showStarsOnly
      ? history.filter((r) => {
          const id = r.type === 'transcription' ? r.data.id : r.data.id;
          return isStarred(id);
        })
      : history;
    if (targets.length === 0) return;
    const metadata = targets.map((r) => {
      const id = r.type === 'transcription' ? r.data.id : r.data.id;
      return {
        id,
        type: r.type,
        ...(r.type === 'transcription'
          ? { text: r.data.text, duration: r.data.duration, language: r.data.language, audioFileName: r.data.audioFileName }
          : { text: r.data.text, duration: r.data.duration, voice: r.data.voice }),
        tags: getResultTags(id),
        starred: isStarred(id),
        timestamp: r.data.timestamp,
      };
    });
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audio-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchDownload = async () => {
    const targets = showStarsOnly
      ? history.filter((r) => {
          const id = r.type === 'transcription' ? r.data.id : r.data.id;
          return isStarred(id);
        })
      : history;
    for (const r of targets) {
      if (r.type === 'synthesis' && r.data.audioUrl) {
        await downloadAudio(r.data.audioUrl, `speech-${r.data.id.slice(0, 8)}.wav`);
      }
    }
  };

  const filteredAndSortedHistory = (() => {
    let result = [...history];
    if (showStarsOnly) {
      result = result.filter((r) => {
        const id = r.type === 'transcription' ? r.data.id : r.data.id;
        return isStarred(id);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const text = r.type === 'transcription' ? r.data.text : r.data.text;
        return text.toLowerCase().includes(q) ||
          (r.type === 'transcription' ? r.data.audioFileName : r.data.voice).toLowerCase().includes(q) ||
          getResultTags(r.type === 'transcription' ? r.data.id : r.data.id).some((t) => t.includes(q));
      });
    }
    result.sort((a, b) => {
      const aTime = new Date(a.data.timestamp).getTime();
      const bTime = new Date(b.data.timestamp).getTime();
      switch (sortBy) {
        case 'oldest': return aTime - bTime;
        case 'duration-asc': return a.data.duration - b.data.duration;
        case 'duration-desc': return b.data.duration - a.data.duration;
        default: return bTime - aTime;
      }
    });
    return result;
  })();

  const getGridTemplateColumns = () => {
    switch (density) {
      case 'compact': return 'repeat(auto-fill, minmax(200px, 1fr))';
      case 'spacious': return 'repeat(auto-fill, minmax(350px, 1fr))';
      default: return 'repeat(auto-fill, minmax(260px, 1fr))';
    }
  };

  const historyCount = history.length;
  const configCount = savedConfigs.length;

  return (
    <div className="orch-view">
      <audio ref={audioRef} />

      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Audio</h1>
          <p className="orch-view-subtitle">
            Speech-to-text transcription and text-to-speech synthesis with local Qwen3 models.
          </p>
        </div>
        <div className="orch-view-actions">
          {tab === 'generator' && (
            <>
              {(transcriptions.length > 0 || syntheses.length > 0) && (
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
            {/* Mode Toggle */}
            <div className="orch-card" style={{ padding: '8px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 1, background: 'var(--bg-3)', borderRadius: 8, padding: 2 }}>
                  <button
                    className={`orch-btn sm${mode === 'stt' ? '' : ' ghost'}`}
                    onClick={() => setMode('stt')}
                    style={mode === 'stt' ? { background: 'var(--accent)', color: '#fff' } : undefined}
                  >
                    <Mic size={14} />Speech to Text
                  </button>
                  <button
                    className={`orch-btn sm${mode === 'tts' ? '' : ' ghost'}`}
                    onClick={() => setMode('tts')}
                    style={mode === 'tts' ? { background: 'var(--accent)', color: '#fff' } : undefined}
                  >
                    <Volume2 size={14} />Text to Speech
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

            {/* STT Mode: Audio Input */}
            {mode === 'stt' && (
              <div className="orch-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Audio Input</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      Model: {activeSttModel?.name || 'None'}
                    </span>
                  </div>

                  {audioDataUrl ? (
                    <div className="space-y-3">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileAudio size={24} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {audioFile?.name || 'Recording'}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                            {audioFile ? `${(audioFile.size / 1024).toFixed(1)} KB` : 'Audio ready'}
                          </p>
                        </div>
                        <button className="orch-icon-btn" onClick={() => togglePlayback(audioDataUrl, 'preview')} title="Play/Pause">
                          {currentlyPlaying === 'preview' ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button className="orch-icon-btn" onClick={clearAudio} title="Remove" style={{ color: 'var(--red)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <audio src={audioDataUrl} controls style={{ width: '100%', height: 36 }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button className="orch-btn xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={12} />Upload Audio
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>or</span>
                      {isRecording ? (
                        <button className="orch-btn xs" onClick={stopRecording} style={{ background: 'var(--red)', color: '#fff' }}>
                          <MicOff size={12} />Stop Recording
                        </button>
                      ) : (
                        <button className="orch-btn xs" onClick={startRecording}>
                          <Mic size={12} />Record Audio
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TTS Mode: Text Input */}
            {mode === 'tts' && (
              <div className="orch-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Text to Synthesize</span>
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
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text to convert to speech..."
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
                    rows={4}
                    disabled={isProcessing}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {text.length} characters · Model: {activeTtsModel?.name || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="orch-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Mode: {executionMode}
                </span>
                <button
                  className="orch-btn primary"
                  onClick={mode === 'stt' ? handleTranscribe : handleSynthesize}
                  disabled={
                    isProcessing ||
                    (mode === 'stt' ? !audioDataUrl || !activeSttModel : !text.trim() || !activeTtsModel)
                  }
                >
                  {isProcessing ? (
                    <><RefreshCw size={16} className="animate-spin" /> {mode === 'stt' ? 'Transcribing...' : 'Synthesizing...'}</>
                  ) : (
                    <>{mode === 'stt' ? <Mic size={16} /> : <Volume2 size={16} />} {mode === 'stt' ? 'Transcribe' : 'Synthesize Speech'}</>
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
                  Make sure the Qwen3 audio service is running on port 8001.
                </p>
              </div>
            )}

            {/* Results Gallery */}
            <div className="orch-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">
                  {mode === 'stt' ? <Mic size={14} /> : <Volume2 size={14} />}
                  {mode === 'stt' ? 'Transcriptions' : 'Generated Audio'}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {mode === 'stt' ? transcriptions.length : syntheses.length} result{(mode === 'stt' ? transcriptions.length : syntheses.length) !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="orch-btn xs ghost"
                    onClick={mode === 'stt' ? clearTranscriptions : clearSyntheses}
                    style={{ color: 'var(--red)' }}
                  >
                    <Trash2 size={12} />Clear
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {mode === 'stt' && transcriptions.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
                    <Mic size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No transcriptions yet</p>
                    <p style={{ fontSize: 13 }}>Upload or record audio and click Transcribe</p>
                  </div>
                )}
                {mode === 'tts' && syntheses.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
                    <Volume2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No audio generated yet</p>
                    <p style={{ fontSize: 13 }}>Enter text and click Synthesize Speech</p>
                  </div>
                )}
                {viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: getGridTemplateColumns(), gap: density === 'compact' ? 6 : density === 'spacious' ? 14 : 10 }}>
                    {(mode === 'stt' ? transcriptions : syntheses).map((result) => {
                      const id = result.id;
                      const isTranscription = mode === 'stt';
                      const textContent = isTranscription ? (result as any).text : (result as any).text;
                      const duration = (result as any).duration;
                      const audioUrl = !isTranscription ? (result as any).audioUrl : null;
                      return (
                        <div
                          key={id}
                          className="orch-row"
                          style={{
                            cursor: 'pointer',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid var(--border-c)',
                          }}
                          onClick={() => {
                            const audioResult: AudioResult = isTranscription
                              ? { type: 'transcription', data: result as any }
                              : { type: 'synthesis', data: result as any };
                            setSelectedResult(audioResult);
                          }}
                        >
                          <p style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {textContent}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-2)' }}>
                            <span>{duration.toFixed(1)}s</span>
                            {!isTranscription && audioUrl && (
                              <button
                                className="orch-icon-btn"
                                style={{ width: 24, height: 24, marginLeft: 'auto' }}
                                onClick={(e) => { e.stopPropagation(); togglePlayback(audioUrl, id); }}
                              >
                                {currentlyPlaying === id ? <Pause size={12} /> : <Play size={12} />}
                              </button>
                            )}
                            <button
                              className="orch-icon-btn"
                              style={{ width: 24, height: 24 }}
                              onClick={(e) => { e.stopPropagation(); toggleStar(id); }}
                            >
                              <Star size={12} fill={isStarred(id) ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* List view */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(mode === 'stt' ? transcriptions : syntheses).map((result) => {
                      const id = result.id;
                      const isTranscription = mode === 'stt';
                      const textContent = isTranscription ? (result as any).text : (result as any).text;
                      const duration = (result as any).duration;
                      const audioUrl = !isTranscription ? (result as any).audioUrl : null;
                      return (
                        <div
                          key={id}
                          className="orch-row"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            const audioResult: AudioResult = isTranscription
                              ? { type: 'transcription', data: result as any }
                              : { type: 'synthesis', data: result as any };
                            setSelectedResult(audioResult);
                          }}
                        >
                          <div className="orch-row-icon">
                            {isTranscription ? <Mic size={14} /> : <Volume2 size={14} />}
                          </div>
                          <div className="orch-row-main">
                            <div className="orch-row-title" style={{ fontSize: 13 }}>
                              {textContent.slice(0, 80)}{textContent.length > 80 ? '...' : ''}
                            </div>
                            <div className="orch-row-sub">
                              {duration.toFixed(1)}s · {isTranscription ? (result as any).audioFileName : (result as any).voice}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {!isTranscription && audioUrl && (
                              <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); togglePlayback(audioUrl, id); }}>
                                {currentlyPlaying === id ? <Pause size={12} /> : <Play size={12} />}
                              </button>
                            )}
                            <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); toggleStar(id); }}>
                              <Star size={12} fill={isStarred(id) ? 'currentColor' : 'none'} />
                            </button>
                            <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(textContent, id); }}>
                              {copiedId === id ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                <button className="orch-btn xs ghost" onClick={() => setShowParams(false)}>
                  <X size={12} />Close
                </button>
              </div>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Model Selection */}
                {mode === 'stt' ? (
                  <Field label="STT Model">
                    <select
                      className="orch-select"
                      value={selectedSttModel || ''}
                      onChange={(e) => setSelectedSttModel(e.target.value || null)}
                      disabled={sttModels.length === 0}
                    >
                      {sttModels.length === 0 ? (
                        <option value="">No STT models available</option>
                      ) : (
                        sttModels.map((model) => (
                          <option key={`${model.runtime}:${model.id}`} value={model.id}>
                            {model.name} ({model.runtime})
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                ) : (
                  <Field label="TTS Model">
                    <select
                      className="orch-select"
                      value={selectedTtsModel || ''}
                      onChange={(e) => setSelectedTtsModel(e.target.value || null)}
                      disabled={ttsModels.length === 0}
                    >
                      {ttsModels.length === 0 ? (
                        <option value="">No TTS models available</option>
                      ) : (
                        ttsModels.map((model) => (
                          <option key={`${model.runtime}:${model.id}`} value={model.id}>
                            {model.name} ({model.runtime})
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                )}

                {mode === 'stt' ? (
                  <>
                    <Field label="Language">
                      <select
                        className="orch-select"
                        value={params.language || 'auto'}
                        onChange={(e) => setParams({ language: e.target.value })}
                      >
                        <option value="auto">Auto Detect</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="ru">Russian</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                        <option value="zh">Chinese</option>
                      </select>
                    </Field>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id="translate"
                        checked={params.translate || false}
                        onChange={(e) => setParams({ translate: e.target.checked })}
                      />
                      <label htmlFor="translate" style={{ fontSize: 12, color: 'var(--text-1)' }}>
                        Translate to English
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <Field label={`Speed: ${params.speed || 1.0}x`}>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={params.speed || 1.0}
                        onChange={(e) => setParams({ speed: parseFloat(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </Field>
                    <Field label={`Pitch: ${params.pitch || 1.0}x`}>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={params.pitch || 1.0}
                        onChange={(e) => setParams({ pitch: parseFloat(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </Field>
                    <Field label="Output Format">
                      <select
                        className="orch-select"
                        value={params.outputFormat || 'wav'}
                        onChange={(e) => setParams({ outputFormat: e.target.value as 'mp3' | 'wav' | 'ogg' })}
                      >
                        <option value="wav">WAV</option>
                        <option value="mp3">MP3</option>
                        <option value="ogg">OGG</option>
                      </select>
                    </Field>
                  </>
                )}
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
              <div className="orch-card-title"><FileAudio size={14} />Audio History</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {history.some((r) => {
                  const id = r.type === 'transcription' ? r.data.id : r.data.id;
                  return isStarred(id);
                }) && (
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
                    placeholder="Search by text, model, or tag..."
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
                  </select>
                </div>
              </div>
            )}

            <div className="orch-list">
              {filteredAndSortedHistory.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
                  {searchQuery ? 'No results match your search.' : 'No audio history yet. Go to the Generator tab to create some.'}
                </div>
              ) : filteredAndSortedHistory.map((r) => {
                const id = r.type === 'transcription' ? r.data.id : r.data.id;
                const isTranscription = r.type === 'transcription';
                const textContent = r.data.text;
                const duration = r.data.duration;
                const audioUrl = !isTranscription ? (r.data as any).audioUrl : null;
                return (
                  <div
                    className={`orch-row${selectedResult && ((selectedResult.type === 'transcription' ? selectedResult.data.id : selectedResult.data.id) === id) ? ' active' : ''}`}
                    key={id}
                    onClick={() => setSelectedResult(r)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="orch-row-icon">
                      {isTranscription ? <Mic size={14} /> : <Volume2 size={14} />}
                    </div>
                    <div className="orch-row-main">
                      <div className="orch-row-title" style={{ fontSize: 13 }}>
                        {textContent.slice(0, 60)}{textContent.length > 60 ? '...' : ''}
                      </div>
                      <div className="orch-row-sub">
                        {duration.toFixed(1)}s · {isTranscription ? r.data.audioFileName : r.data.voice}
                      </div>
                      {getResultTags(id).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {getResultTags(id).map((tag) => (
                            <span key={tag} className="orch-chip" style={{ fontSize: 10 }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="orch-row-meta" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {new Date(r.data.timestamp).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {!isTranscription && audioUrl && (
                        <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); togglePlayback(audioUrl, id); }}>
                          {currentlyPlaying === id ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                      )}
                      <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); toggleStar(id); }}>
                        <Star size={12} fill={isStarred(id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedResult && (
            <div className="orch-card" style={{ height: 'fit-content' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">Result Details</div>
              </div>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedResult.type === 'transcription' ? (
                  <>
                    <Field label="Transcribed Text">
                      <textarea className="orch-textarea" rows={4} value={selectedResult.data.text} readOnly />
                    </Field>
                    <Field label="Duration">
                      <input className="orch-input" value={`${selectedResult.data.duration.toFixed(1)}s`} readOnly />
                    </Field>
                    <Field label="Audio File">
                      <input className="orch-input" value={selectedResult.data.audioFileName} readOnly />
                    </Field>
                    {selectedResult.data.language && (
                      <Field label="Language">
                        <input className="orch-input" value={selectedResult.data.language} readOnly />
                      </Field>
                    )}
                  </>
                ) : (
                  <>
                    <Field label="Synthesized Text">
                      <textarea className="orch-textarea" rows={4} value={selectedResult.data.text} readOnly />
                    </Field>
                    <Field label="Duration">
                      <input className="orch-input" value={`${selectedResult.data.duration.toFixed(1)}s`} readOnly />
                    </Field>
                    <Field label="Voice">
                      <input className="orch-input" value={selectedResult.data.voice} readOnly />
                    </Field>
                    {selectedResult.data.audioUrl && (
                      <div>
                        <audio src={selectedResult.data.audioUrl} controls style={{ width: '100%', height: 36 }} />
                      </div>
                    )}
                  </>
                )}

                {/* Tags */}
                <Field label="Tags">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {getResultTags(selectedResult.type === 'transcription' ? selectedResult.data.id : selectedResult.data.id).map((tag) => (
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
                      const id = selectedResult.type === 'transcription' ? selectedResult.data.id : selectedResult.data.id;
                      copyToClipboard(selectedResult.data.text, id);
                    }}
                  >
                    <Copy size={14} />Copy Text
                  </button>
                  {selectedResult.type === 'synthesis' && selectedResult.data.audioUrl && (
                    <button className="orch-btn" onClick={() => downloadAudio(selectedResult.data.audioUrl, `speech-${selectedResult.data.id.slice(0, 8)}.wav`)}>
                      <Download size={14} />
                    </button>
                  )}
                  <button
                    className="orch-btn"
                    onClick={() => {
                      const id = selectedResult.type === 'transcription' ? selectedResult.data.id : selectedResult.data.id;
                      removeFromHistory(id);
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
                  No saved configs yet. Generate audio and click "Save Config" to save one.
                </div>
              )}
              {savedConfigs.map((cfg) => (
                <div className="orch-row" key={cfg.id}>
                  <div className="orch-row-icon"><Save size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">
                      {cfg.name}
                      <span className="orch-chip purple" style={{ marginLeft: 6 }}>{cfg.mode === 'stt' ? 'STT' : 'TTS'}</span>
                    </div>
                    <div className="orch-row-sub">
                      {cfg.mode === 'stt'
                        ? `Language: ${cfg.params.language || 'auto'}`
                        : `Speed: ${cfg.params.speed || 1.0}x · Pitch: ${cfg.params.pitch || 1.0}x · Format: ${cfg.params.outputFormat || 'wav'}`}
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
                  No prompt templates saved yet. Save TTS text as a template from the Generator tab.
                </div>
              )}
              {promptTemplates.map((t) => (
                <div className="orch-row" key={t.id}>
                  <div className="orch-row-icon"><FileText size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">{t.name}</div>
                    <div className="orch-row-sub">{t.text.slice(0, 80)}{t.text.length > 80 ? '...' : ''}</div>
                  </div>
                  <button
                    className="orch-btn xs"
                    onClick={() => {
                      setText(t.text);
                      setMode('tts');
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
              <div className="orch-card-title">Save Audio Config</div>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Config name">
                <input
                  className="orch-input"
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="e.g. My TTS preset"
                  autoFocus
                />
              </Field>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <strong>{mode === 'stt' ? 'STT' : 'TTS'}</strong>
                {mode === 'stt'
                  ? ` · Language: ${params.language || 'auto'}`
                  : ` · Speed: ${params.speed || 1.0}x · Pitch: ${params.pitch || 1.0}x`}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="orch-btn" onClick={() => { setShowSaveConfig(false); setConfigName(''); }}>Cancel</button>
                <button
                  className="orch-btn primary"
                  onClick={() => {
                    saveConfig(
                      configName || `Config ${configCount + 1}`,
                      mode,
                      params,
                      selectedSttModel,
                      selectedTtsModel,
                      mode === 'tts' ? text : undefined,
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
                  placeholder="e.g. Narration voice"
                  autoFocus
                />
              </Field>
              <Field label="Text">
                <textarea className="orch-textarea" rows={3} value={text} readOnly />
              </Field>
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

      {/* ===== Detail Modal (from Generator grid) ===== */}
      {selectedResult && tab === 'generator' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div
            ref={lightboxRef}
            style={{
              maxWidth: 700, maxHeight: '95vh',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orch-card" style={{ flexShrink: 0 }}>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedResult.type === 'transcription' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, lineHeight: 1.5 }}>{selectedResult.data.text}</p>
                      </div>
                      <button className="orch-btn xs" onClick={() => toggleStar(selectedResult.data.id)}>
                        <Star size={12} fill={isStarred(selectedResult.data.id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Duration: {selectedResult.data.duration.toFixed(1)}s · File: {selectedResult.data.audioFileName}
                      {selectedResult.data.language && <> · Language: {selectedResult.data.language}</>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="orch-btn xs" onClick={() => copyToClipboard(selectedResult.data.text, selectedResult.data.id)}>
                        {copiedId === selectedResult.data.id ? <Check size={12} /> : <Copy size={12} />} Copy
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, lineHeight: 1.5 }}>{selectedResult.data.text}</p>
                      </div>
                      <button className="orch-btn xs" onClick={() => toggleStar(selectedResult.data.id)}>
                        <Star size={12} fill={isStarred(selectedResult.data.id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    <audio src={selectedResult.data.audioUrl} controls style={{ width: '100%', height: 40 }} />
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Duration: {selectedResult.data.duration.toFixed(1)}s · Voice: {selectedResult.data.voice}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="orch-btn xs" onClick={() => copyToClipboard(selectedResult.data.text, selectedResult.data.id)}>
                        {copiedId === selectedResult.data.id ? <Check size={12} /> : <Copy size={12} />} Copy
                      </button>
                      <button className="orch-btn xs" onClick={() => downloadAudio(selectedResult.data.audioUrl, `speech-${selectedResult.data.id.slice(0, 8)}.wav`)}>
                        <Download size={12} />Download
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}