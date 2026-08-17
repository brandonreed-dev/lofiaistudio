import { useEffect, useMemo, useState, useCallback } from 'react';
import { useStorageStore, StorageFileInfo } from '@/stores/storage';
import {
  HardDrive,
  Folder,
  File,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  Code,
  Trash2,
  Download,
  RefreshCw,
  ArrowUp,
  List,
  Grid3X3,
  ChevronRight,
  Home,
  AlertCircle,
  FileX,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { Field } from '../panelPrimitives';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getFileIcon(mimeCategory: string, extension: string) {
  const iconProps = { size: 16 };
  switch (mimeCategory) {
    case 'image': return <ImageIcon {...iconProps} style={{ color: 'var(--pink)' }} />;
    case 'video': return <VideoIcon {...iconProps} style={{ color: 'var(--accent-2)' }} />;
    case 'audio': return <Music {...iconProps} style={{ color: 'var(--cyan, #06b6d4)' }} />;
    case 'json': return <Code {...iconProps} style={{ color: 'var(--amber)' }} />;
    case 'text': return <FileText {...iconProps} style={{ color: 'var(--text-2)' }} />;
    default: return <File {...iconProps} style={{ color: 'var(--text-3)' }} />;
  }
}

function getFileIconLarge(mimeCategory: string) {
  const props = { size: 32 };
  switch (mimeCategory) {
    case 'image': return <ImageIcon {...props} style={{ opacity: 0.4 }} />;
    case 'video': return <VideoIcon {...props} style={{ opacity: 0.4 }} />;
    case 'audio': return <Music {...props} style={{ opacity: 0.4 }} />;
    case 'json': return <Code {...props} style={{ opacity: 0.4 }} />;
    case 'text': return <FileText {...props} style={{ opacity: 0.4 }} />;
    default: return <File {...props} style={{ opacity: 0.4 }} />;
  }
}

export function StoragePanel() {
  const {
    sources,
    activeSourceId,
    isLoadingSources,
    files,
    currentPath,
    isLoadingFiles,
    filesError,
    selectedFile,
    previewContent,
    isLoadingPreview,
    viewMode,
    filter,
    loadSources,
    setActiveSource,
    navigateToDir,
    navigateUp,
    selectFile,
    deleteFile,
    setViewMode,
    setFilter,
    getFileUrl,
    getBreadcrumbs,
  } = useStorageStore();

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Filter files
  const filteredFiles = useMemo(() => {
    if (filter === 'all') return files;
    return files.filter((f) => f.type === 'directory' || f.mimeCategory === filter);
  }, [files, filter]);

  const activeSource = sources.find((s) => s.id === activeSourceId);
  const breadcrumbs = getBreadcrumbs();

  const handleDownload = useCallback(async (file: StorageFileInfo) => {
    const url = getFileUrl(file);
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [getFileUrl]);

  const handleDeleteConfirm = async (file: StorageFileInfo) => {
    const success = await deleteFile(file);
    if (success) {
      setConfirmDelete(null);
      // Deselect if deleted
      if (selectedFile?.path === file.path) {
        selectFile(null);
      }
    } else {
      alert('Failed to delete file');
    }
  };

  return (
    <div className="orch-view">
      {/* Header */}
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Storage & Vectors</h1>
          <p className="orch-view-subtitle">
            Browse generated outputs, workflow results, and files from connected runtimes.
          </p>
        </div>
        <div className="orch-view-actions">
          <button className="orch-btn" onClick={() => loadSources()}>
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
        {/* Source Tabs */}
        {isLoadingSources ? (
          <div className="orch-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
              <RefreshCw size={14} className="animate-spin" /> Loading sources...
            </div>
          </div>
        ) : sources.length === 0 ? (
          <div className="orch-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
              <AlertCircle size={14} /> No storage sources available
            </div>
          </div>
        ) : (
          <div className="orch-card" style={{ padding: '6px 10px' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {sources.map((source) => (
                <button
                  key={source.id}
                  className={`orch-subtab${activeSourceId === source.id ? ' active' : ''}`}
                  onClick={() => setActiveSource(source.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <HardDrive size={14} />
                  {source.label}
                  {!source.exists && (
                    <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 4 }}>offline</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active source info & breadcrumbs */}
        {activeSource && (
          <div className="orch-card" style={{ padding: '8px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <button
                className="orch-icon-btn"
                onClick={() => { setActiveSource(activeSourceId!); }}
                title="Root"
                style={{ width: 24, height: 24 }}
              >
                <Home size={12} />
              </button>
              {currentPath && (
                <button
                  className="orch-icon-btn"
                  onClick={navigateUp}
                  title="Up one level"
                  style={{ width: 24, height: 24 }}
                >
                  <ArrowUp size={12} />
                </button>
              )}
              <ChevronRight size={12} style={{ color: 'var(--text-3)' }} />
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{activeSource.label}</span>
              {breadcrumbs.map((crumb) => (
                <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChevronRight size={10} style={{ color: 'var(--text-3)' }} />
                  <button
                    className="breadcrumb-link"
                    onClick={() => navigateToDir(crumb.path)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 13,
                    }}
                  >
                    {crumb.label}
                  </button>
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
                {filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}
                {filter !== 'all' && ` (filtered)`}
              </span>
            </div>
          </div>
        )}

        {/* Filter & View Toggle */}
        <div className="orch-card" style={{ padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 1, background: 'var(--bg-3)', borderRadius: 8, padding: 2 }}>
              {(['all', 'image', 'video', 'audio', 'json', 'text'] as const).map((f) => (
                <button
                  key={f}
                  className={`orch-btn xs${filter === f ? '' : ' ghost'}`}
                  onClick={() => setFilter(f)}
                  style={filter === f ? { background: 'var(--accent)', color: '#fff' } : undefined}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                className={`orch-icon-btn${viewMode === 'list' ? ' active' : ''}`}
                title="List view"
                onClick={() => setViewMode('list')}
              >
                <List size={14} />
              </button>
              <button
                className={`orch-icon-btn${viewMode === 'grid' ? ' active' : ''}`}
                title="Grid view"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* File listing */}
          <div className="orch-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="orch-card-header">
              <div className="orch-card-title">
                <Folder size={14} />
                {currentPath || (activeSource?.label ?? 'Files')}
              </div>
              {isLoadingFiles && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--text-2)' }} />}
            </div>

            {isLoadingFiles ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', gap: 8 }}>
                <RefreshCw size={16} className="animate-spin" /> Loading...
              </div>
            ) : filesError ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', gap: 8, padding: 24 }}>
                <AlertCircle size={16} /> {filesError}
              </div>
            ) : !activeSource?.exists ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', padding: 40, textAlign: 'center' }}>
                <HardDrive size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Source not found</p>
                <p style={{ fontSize: 13 }}>The directory {activeSource?.path} does not exist. Make sure the runtime is installed and has generated some outputs.</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', padding: 40, textAlign: 'center' }}>
                <FileX size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No files found</p>
                <p style={{ fontSize: 13 }}>
                  {filter !== 'all'
                    ? `No ${filter} files in this directory. Try changing the filter.`
                    : 'This directory is empty. Generate some content first.'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              /* List View */
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className="orch-list">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.path}
                      className={`orch-row${selectedFile?.path === file.path ? ' active' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => file.type === 'directory' ? navigateToDir(file.relativePath) : selectFile(file)}
                    >
                      <div className="orch-row-icon">
                        {file.type === 'directory'
                          ? <Folder size={16} style={{ color: 'var(--accent-2)' }} />
                          : getFileIcon(file.mimeCategory, file.extension)}
                      </div>
                      <div className="orch-row-main">
                        <div className="orch-row-title" style={{ fontSize: 13 }}>
                          {file.name}
                          {file.type === 'directory' && <span className="orch-chip" style={{ marginLeft: 6, fontSize: 10 }}>dir</span>}
                        </div>
                        <div className="orch-row-sub">
                          {file.type === 'file' && (
                            <>
                              <span>{file.extension.toUpperCase()} &middot; {formatFileSize(file.size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="orch-row-meta" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {formatDate(file.modifiedAt)}
                      </div>
                      {file.type === 'file' && (
                        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
                          <button
                            className="orch-icon-btn"
                            title="Download"
                            onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                          >
                            <Download size={12} />
                          </button>
                          <button
                            className="orch-icon-btn"
                            title="Delete"
                            style={{ color: 'var(--red)' }}
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(file.path); }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Grid View */
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {filteredFiles.map((file) => (
                    <div
                      key={file.path}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${selectedFile?.path === file.path ? 'var(--accent)' : 'var(--border-c)'}`,
                        background: 'var(--bg-3)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s',
                      }}
                      onClick={() => file.type === 'directory' ? navigateToDir(file.relativePath) : selectFile(file)}
                    >
                      {file.type === 'directory' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, background: 'var(--bg-2)' }}>
                          <Folder size={36} style={{ color: 'var(--accent-2)', opacity: 0.6 }} />
                        </div>
                      ) : file.mimeCategory === 'image' ? (
                        <div style={{ height: 100, background: 'var(--bg-2)', position: 'relative' }}>
                          <img
                            src={getFileUrl(file)}
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                              (e.currentTarget.parentElement!.querySelector('.fallback') as HTMLElement).style.display = 'flex';
                            }}
                          />
                          <div className="fallback" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-2)' }}>
                            {getFileIconLarge('image')}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, background: 'var(--bg-2)' }}>
                          {getFileIconLarge(file.mimeCategory)}
                        </div>
                      )}
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)' }}>
                          {file.name}
                        </div>
                        {file.type === 'file' && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {formatFileSize(file.size)}
                          </div>
                        )}
                        {file.type === 'directory' && (
                          <span className="orch-chip" style={{ fontSize: 10 }}>dir</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {selectedFile && selectedFile.type === 'file' && (
            <div className="orch-card" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', height: 'fit-content', maxHeight: '100%', overflow: 'hidden' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">
                  <Eye size={14} />Preview
                </div>
                <button className="orch-icon-btn" onClick={() => selectFile(null)} title="Close">
                  &times;
                </button>
              </div>

              {/* Image Preview */}
              {selectedFile.mimeCategory === 'image' && (
                <div style={{ padding: 12 }}>
                  <img
                    src={getFileUrl(selectedFile)}
                    alt={selectedFile.name}
                    style={{ width: '100%', borderRadius: 8, maxHeight: 240, objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Video Preview */}
              {selectedFile.mimeCategory === 'video' && (
                <div style={{ padding: 12 }}>
                  <video
                    controls
                    style={{ width: '100%', borderRadius: 8, maxHeight: 200 }}
                    src={getFileUrl(selectedFile)}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Audio Preview */}
              {selectedFile.mimeCategory === 'audio' && (
                <div style={{ padding: 12 }}>
                  <audio
                    controls
                    style={{ width: '100%' }}
                    src={getFileUrl(selectedFile)}
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              )}

              {/* JSON/Text Preview */}
              {(selectedFile.mimeCategory === 'json' || selectedFile.mimeCategory === 'text') && (
                <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                  {isLoadingPreview ? (
                    <div style={{ color: 'var(--text-2)', padding: 12, textAlign: 'center' }}>
                      <RefreshCw size={14} className="animate-spin" /> Loading...
                    </div>
                  ) : (
                    <pre style={{
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: 'var(--text-1)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      margin: 0,
                      background: 'var(--bg-2)',
                      padding: 10,
                      borderRadius: 6,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}>
                      {typeof previewContent === 'string'
                        ? previewContent
                        : JSON.stringify(previewContent, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* File metadata */}
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-c)', paddingTop: 12 }}>
                <Field label="Name">
                  <div style={{ fontSize: 12, color: 'var(--text-1)', wordBreak: 'break-all' }}>{selectedFile.name}</div>
                </Field>
                <Field label="Size">
                  <div style={{ fontSize: 12, color: 'var(--text-1)' }}>{formatFileSize(selectedFile.size)}</div>
                </Field>
                <Field label="Modified">
                  <div style={{ fontSize: 12, color: 'var(--text-1)' }}>{formatDate(selectedFile.modifiedAt)}</div>
                </Field>
                <Field label="Path">
                  <div style={{ fontSize: 11, color: 'var(--text-2)', wordBreak: 'break-all' }}>{selectedFile.relativePath}</div>
                </Field>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="orch-btn sm primary" style={{ flex: 1 }} onClick={() => handleDownload(selectedFile)}>
                    <Download size={12} />Download
                  </button>
                  <button
                    className="orch-btn sm"
                    onClick={() => window.open(getFileUrl(selectedFile), '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    className="orch-btn sm"
                    style={{ color: 'var(--red)' }}
                    onClick={() => setConfirmDelete(selectedFile.path)}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 360 }}>
            <div className="orch-card-header">
              <div className="orch-card-title"><AlertCircle size={14} style={{ color: 'var(--red)' }} />Confirm Delete</div>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-1)' }}>
                Are you sure you want to delete this file? This action cannot be undone.
              </p>
              <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', padding: 8, borderRadius: 6 }}>
                {confirmDelete}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="orch-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button
                  className="orch-btn"
                  style={{ background: 'var(--red)', color: '#fff' }}
                  onClick={() => {
                    const file = files.find((f) => f.path === confirmDelete);
                    if (file) handleDeleteConfirm(file);
                  }}
                >
                  <Trash2 size={14} />Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}