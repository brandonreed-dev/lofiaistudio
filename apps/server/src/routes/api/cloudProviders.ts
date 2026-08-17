import { Router } from 'express';
import type { Request, Response } from 'express';
import { dbOperations } from '../../db/index.js';
import type { CloudProviderConfig, ApiResponse } from '@lofiaistudio/shared';
import { createCloudAdapterRegistry } from '../../adapters/cloud/index.js';
import { createHash, randomBytes } from 'crypto';

// Simple encryption for API keys at rest
const ENCRYPTION_KEY = process.env.CLOUD_ENCRYPTION_KEY || 'lofiaistudio-default-key-change-in-production';

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createHash('sha256').update(ENCRYPTION_KEY).digest();
  // Simple XOR-based obfuscation (not true encryption, but prevents plaintext in DB)
  const key = cipher.toString('hex');
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(iv.toString('hex') + ':' + Buffer.from(result).toString('base64')).toString('base64');
}

function decrypt(encoded: string): string {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const [ivHex, encryptedB64] = decoded.split(':');
    if (!ivHex || !encryptedB64) return '';
    const cipher = createHash('sha256').update(ENCRYPTION_KEY).digest();
    const key = cipher.toString('hex');
    const encrypted = Buffer.from(encryptedB64, 'base64').toString();
    let result = '';
    for (let i = 0; i < encrypted.length; i++) {
      result += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
}

export function createCloudProvidersRouter(): Router {
  const router = Router();

  // GET /api/cloud-providers - List all configured cloud providers (without exposing full API keys)
  router.get('/', (_req: Request, res: Response) => {
    const providers = dbOperations.getCollection<CloudProviderConfig>('cloudProviders');
    // Mask API keys for security
    const masked = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` : undefined,
    }));
    const response: ApiResponse<CloudProviderConfig[]> = { success: true, data: masked };
    res.json(response);
  });

  // GET /api/cloud-providers/:id - Get a specific provider config
  router.get('/:id', (req: Request, res: Response) => {
    const providers = dbOperations.getCollection<CloudProviderConfig>('cloudProviders');
    const provider = providers.find((p) => p.id === req.params.id);
    if (!provider) {
      const response: ApiResponse<null> = { success: false, error: 'Provider not found' };
      return res.status(404).json(response);
    }
    const response: ApiResponse<CloudProviderConfig> = {
      success: true,
      data: {
        ...provider,
        apiKey: provider.apiKey ? `${provider.apiKey.slice(0, 8)}...${provider.apiKey.slice(-4)}` : undefined,
      },
    };
    res.json(response);
  });

  // PUT /api/cloud-providers/:id - Save/update a provider config (with API key)
  router.put('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { apiKey, baseUrl } = req.body as { apiKey?: string; baseUrl?: string };

    const providers = dbOperations.getCollection<CloudProviderConfig>('cloudProviders');
    const existing = providers.find((p) => p.id === id);

    if (existing) {
      const update: Partial<CloudProviderConfig> = { id: id as CloudProviderConfig['id'] };
      if (apiKey) update.apiKey = encrypt(apiKey);
      if (baseUrl !== undefined) update.baseUrl = baseUrl;
      dbOperations.updateInCollection('cloudProviders', id, update);
    } else {
      // Create new provider entry
      const newProvider: CloudProviderConfig = {
        id: id as CloudProviderConfig['id'],
        name: req.body.name || id,
        apiKey: apiKey ? encrypt(apiKey) : undefined,
        baseUrl,
        supportedModalities: req.body.supportedModalities || [],
      };
      dbOperations.addToCollection('cloudProviders', newProvider);
    }

    const response: ApiResponse<{ id: string }> = { success: true, data: { id } };
    res.json(response);
  });

  // DELETE /api/cloud-providers/:id - Remove a provider config
  router.delete('/:id', (req: Request, res: Response) => {
    dbOperations.deleteFromCollection('cloudProviders', req.params.id);
    const response: ApiResponse<{ id: string }> = { success: true, data: { id: req.params.id } };
    res.json(response);
  });

  // POST /api/cloud-providers/:id/validate - Test a provider connection
  router.post('/:id/validate', async (req: Request, res: Response) => {
    try {
      const providers = dbOperations.getCollection<CloudProviderConfig>('cloudProviders');
      const provider = providers.find((p) => p.id === req.params.id);
      if (!provider || !provider.apiKey) {
        const response: ApiResponse<null> = { success: false, error: 'Provider not configured' };
        return res.status(404).json(response);
      }

      const decryptedKey = decrypt(provider.apiKey);
      const registry = createCloudAdapterRegistry({ [provider.id]: decryptedKey });
      const adapter = registry.get(provider.id as any);
      
      if (!adapter) {
        const response: ApiResponse<null> = { success: false, error: `No adapter for provider: ${provider.id}` };
        return res.status(400).json(response);
      }

      const valid = await adapter.validateConnection();
      const response: ApiResponse<{ valid: boolean }> = { success: true, data: { valid } };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
      res.status(500).json(response);
    }
  });

  return router;
}

// Export decrypt for use by other modules
export { decrypt };