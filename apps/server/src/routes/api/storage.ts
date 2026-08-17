import { Router } from 'express';
import { join, relative, extname, resolve, basename } from 'path';
import { readdirSync, statSync, readFileSync, existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import type { ApiResponse } from '@lofiaistudio/shared';
import multer from 'multer';

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

// Known output directories to scan — Windows paths are tried first for this user's setup
const home = homedir();

const SOURCE_DIRS: Record<string, string> = {
  'lofiaistudio': join(home, '.lofiaistudio', 'outputs'),
  'comfyui': join(home, 'Documents', 'ComfyUI', 'output'),
};

// Also check alternate common ComfyUI locations
const COMFYUI_ALTERNATES = [
  join(home, 'Documents', 'ComfyUI', 'output'),
  join(home, 'ComfyUI', 'output'),
  join(home, 'AppData', 'Local', 'ComfyUI', 'output'),
];

function resolveComfyUIPath(): string {
  for (const p of COMFYUI_ALTERNATES) {
    if (existsSync(p)) return p;
  }
  // Default to Documents path
  return SOURCE_DIRS['comfyui'];
}

// Override with detected path
SOURCE_DIRS['comfyui'] = resolveComfyUIPath();

function getMimeCategory(ext: string): StorageFileInfo['mimeCategory'] {
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
  const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
  const jsonExts = ['.json'];
  const textExts = ['.txt', '.md', '.csv', '.log', '.yaml', '.yml', '.toml', '.ini'];

  const lower = ext.toLowerCase();
  if (imageExts.includes(lower)) return 'image';
  if (videoExts.includes(lower)) return 'video';
  if (audioExts.includes(lower)) return 'audio';
  if (jsonExts.includes(lower)) return 'json';
  if (textExts.includes(lower)) return 'text';
  return 'other';
}

function scanDirectory(dirPath: string, basePath: string): StorageFileInfo[] {
  try {
    if (!existsSync(dirPath)) return [];
    const entries = readdirSync(dirPath);
    const results: StorageFileInfo[] = [];

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        const ext = extname(entry);
        results.push({
          name: entry,
          path: fullPath,
          relativePath: relative(basePath, fullPath).replace(/\\/g, '/'),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          type: stat.isDirectory() ? 'directory' : 'file',
          extension: ext,
          mimeCategory: stat.isDirectory() ? 'other' : getMimeCategory(ext),
        });
      } catch {
        // Skip entries we can't stat
      }
    }

    // Sort: directories first, then by name
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  } catch {
    return [];
  }
}

export function createStorageRouter(): Router {
  const router = Router();

  // List available sources
  router.get('/sources', (_req, res) => {
    const sources = Object.entries(SOURCE_DIRS).map(([id, path]) => ({
      id,
      label: id === 'lofiaistudio' ? 'LoFi AI Studio Outputs' : 'ComfyUI Outputs',
      path,
      exists: existsSync(path),
    }));
    const response: ApiResponse<typeof sources> = { success: true, data: sources };
    res.json(response);
  });

  // List files in a directory for a given source
  router.get('/list/:sourceId', (req, res) => {
    try {
      const sourceId = req.params.sourceId;
      const subPath = (req.query.path as string) || '';
      const sourceRoot = SOURCE_DIRS[sourceId];

      if (!sourceRoot) {
        return res.status(400).json({ success: false, error: `Unknown source: ${sourceId}` });
      }

      if (!existsSync(sourceRoot)) {
        return res.json({ success: true, data: { source: sourceId, path: '', files: [], error: 'Directory not found' } });
      }

      // Resolve the target directory, ensuring we stay within sourceRoot
      const targetDir = resolve(join(sourceRoot, subPath));
      if (!targetDir.startsWith(resolve(sourceRoot))) {
        return res.status(403).json({ success: false, error: 'Path traversal denied' });
      }

      const files = scanDirectory(targetDir, sourceRoot);
      const response: ApiResponse<{ source: string; path: string; files: StorageFileInfo[] }> = {
        success: true,
        data: {
          source: sourceId,
          path: subPath,
          files,
        },
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get file content (for text/json files)
  router.get('/read', (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'path query parameter required' });
      }
      if (!existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
      const content = readFileSync(filePath, 'utf-8');
      let parsed: unknown = content;
      try { parsed = JSON.parse(content); } catch { /* keep as string */ }
      res.json({ success: true, data: { content: parsed } });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Delete a file
  router.delete('/delete', (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'path query parameter required' });
      }
      if (!existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
      unlinkSync(filePath);
      res.json({ success: true, data: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Upload a file
  const upload = multer({ dest: join(home, '.lofiaistudio', 'uploads') });
  router.post('/upload/:sourceId', upload.single('file'), (req, res) => {
    try {
      const sourceId = req.params.sourceId;
      const subPath = (req.query.path as string) || '';
      const sourceRoot = SOURCE_DIRS[sourceId];

      if (!sourceRoot) {
        return res.status(400).json({ success: false, error: `Unknown source: ${sourceId}` });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file provided' });
      }

      const targetDir = resolve(join(sourceRoot, subPath));
      if (!targetDir.startsWith(resolve(sourceRoot))) {
        return res.status(403).json({ success: false, error: 'Path traversal denied' });
      }

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      const destPath = join(targetDir, req.file.originalname);
      writeFileSync(destPath, readFileSync(req.file.path));
      unlinkSync(req.file.path); // Clean up temp file

      res.json({ success: true, data: { path: destPath, name: req.file.originalname } });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Create a folder
  router.post('/mkdir/:sourceId', (req, res) => {
    try {
      const sourceId = req.params.sourceId;
      const subPath = (req.query.path as string) || '';
      const folderName = req.body.name as string;
      const sourceRoot = SOURCE_DIRS[sourceId];

      if (!sourceRoot) {
        return res.status(400).json({ success: false, error: `Unknown source: ${sourceId}` });
      }

      if (!folderName) {
        return res.status(400).json({ success: false, error: 'Folder name required' });
      }

      const targetDir = resolve(join(sourceRoot, subPath, folderName));
      if (!targetDir.startsWith(resolve(sourceRoot))) {
        return res.status(403).json({ success: false, error: 'Path traversal denied' });
      }

      mkdirSync(targetDir, { recursive: true });
      res.json({ success: true, data: { path: targetDir, name: folderName } });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return router;
}