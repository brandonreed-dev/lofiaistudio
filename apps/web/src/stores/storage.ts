import { create } from 'zustand';
import { api } from '@/lib/api';

export interface StorageFileInfo {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  type: 'file' | 'directory';
  extension: string;
  mimeCategory: 'image' | 'video' | 'audio' | 'json' | 'text' | 'other';
}

export interface StorageSource {
  id: string;
  label: string;
  path: string;
  exists: boolean;
}

export type FileFilter = 'all' | 'image' | 'video' | 'audio' | 'json' | 'text';

interface StorageState {
  // Sources
  sources: StorageSource[];
  activeSourceId: string | null;
  isLoadingSources: boolean;
  sourcesError: string | null;

  // Directory browsing
  currentPath: string;
  files: StorageFileInfo[];
  isLoadingFiles: boolean;
  filesError: string | null;

  // File preview
  selectedFile: StorageFileInfo | null;
  previewContent: unknown;
  isLoadingPreview: boolean;

  // View & filter
  viewMode: 'grid' | 'list';
  filter: FileFilter;

  // Actions
  loadSources: () => Promise<void>;
  setActiveSource: (sourceId: string) => void;
  loadDirectory: (sourceId: string, subPath?: string) => Promise<void>;
  navigateToDir: (dirPath: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  selectFile: (file: StorageFileInfo | null) => Promise<void>;
  deleteFile: (file: StorageFileInfo) => Promise<boolean>;
  setViewMode: (mode: 'grid' | 'list') => void;
  setFilter: (filter: FileFilter) => void;
  getFileUrl: (file: StorageFileInfo) => string;
  getBreadcrumbs: () => { label: string; path: string }[];
}

export const useStorageStore = create<StorageState>((set, get) => ({
  sources: [],
  activeSourceId: null,
  isLoadingSources: false,
  sourcesError: null,

  currentPath: '',
  files: [],
  isLoadingFiles: false,
  filesError: null,

  selectedFile: null,
  previewContent: null,
  isLoadingPreview: false,

  viewMode: 'list',
  filter: 'all',

  loadSources: async () => {
    set({ isLoadingSources: true, sourcesError: null });
    try {
      const sources = await api<StorageSource[]>('/api/storage/sources');
      set({ sources, isLoadingSources: false });
      // Auto-select first available source
      if (sources.length > 0 && !get().activeSourceId) {
        const firstAvailable = sources.find((s) => s.exists) || sources[0];
        set({ activeSourceId: firstAvailable.id });
        get().loadDirectory(firstAvailable.id);
      }
    } catch (error) {
      set({
        sourcesError: error instanceof Error ? error.message : 'Failed to load sources',
        isLoadingSources: false,
      });
    }
  },

  setActiveSource: (sourceId) => {
    set({ activeSourceId: sourceId, currentPath: '', selectedFile: null, previewContent: null });
    get().loadDirectory(sourceId);
  },

  loadDirectory: async (sourceId, subPath = '') => {
    set({ isLoadingFiles: true, filesError: null, selectedFile: null, previewContent: null });
    try {
      const query = subPath ? `?path=${encodeURIComponent(subPath)}` : '';
      const result = await api<{ source: string; path: string; files: StorageFileInfo[] }>(
        `/api/storage/list/${sourceId}${query}`
      );
      set({
        files: result.files,
        currentPath: result.path,
        isLoadingFiles: false,
      });
    } catch (error) {
      set({
        filesError: error instanceof Error ? error.message : 'Failed to load directory',
        isLoadingFiles: false,
        files: [],
      });
    }
  },

  navigateToDir: async (dirPath) => {
    const { activeSourceId } = get();
    if (!activeSourceId) return;
    set({ currentPath: dirPath, selectedFile: null, previewContent: null });
    await get().loadDirectory(activeSourceId, dirPath);
  },

  navigateUp: async () => {
    const { currentPath, activeSourceId } = get();
    if (!activeSourceId) return;
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    set({ currentPath: parentPath, selectedFile: null, previewContent: null });
    await get().loadDirectory(activeSourceId, parentPath);
  },

  selectFile: async (file) => {
    if (!file) {
      set({ selectedFile: null, previewContent: null });
      return;
    }
    set({ selectedFile: file, isLoadingPreview: true });

    // For JSON/text files, read content
    if (file.mimeCategory === 'json' || file.mimeCategory === 'text') {
      try {
        const result = await api<{ content: unknown }>(`/api/storage/read?path=${encodeURIComponent(file.path)}`);
        set({ previewContent: result.content, isLoadingPreview: false });
      } catch {
        set({ previewContent: '(error reading file)', isLoadingPreview: false });
      }
    } else {
      set({ isLoadingPreview: false });
    }
  },

  deleteFile: async (file) => {
    try {
      await api<boolean>(`/api/storage/delete?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
      });
      // Refresh current directory
      const { activeSourceId, currentPath } = get();
      if (activeSourceId) {
        await get().loadDirectory(activeSourceId, currentPath);
      }
      return true;
    } catch {
      return false;
    }
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setFilter: (filter) => set({ filter }),

  getFileUrl: (file) => {
    const { activeSourceId } = get();
    if (!activeSourceId) return '';
    // Use the static file serving URL
    const relativePath = file.relativePath.replace(/\\/g, '/');
    return `/api/files/${activeSourceId}/${relativePath}`;
  },

  getBreadcrumbs: () => {
    const { currentPath } = get();
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = '';
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      crumbs.push({ label: part, path: accumulated });
    }
    return crumbs;
  },
}));
