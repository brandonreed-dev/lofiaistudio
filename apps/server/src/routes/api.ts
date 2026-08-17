import express, { Router } from 'express';
import type { AdapterRegistry } from '../adapters/index.js';
import { createApiRouteHelpers } from './api/context.js';
import { registerApiRoutes } from './api/registerApiRoutes.js';
import { createWorkflowServices } from './api/workflowRunner.js';
import { createWorkflowComfyUIRouter } from './api/workflowComfyUI.js';
import { createStorageRouter } from './api/storage.js';
import { createChatRouter, createFolderRouter } from './api/chat.js';
import { createCloudProvidersRouter } from './api/cloudProviders.js';
import { createCloudAdapterRegistry } from '../adapters/cloud/index.js';
import { decrypt } from './api/cloudProviders.js';
import { dbOperations } from '../db/index.js';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

function resolveComfyUIPath(): string | null {
  const home = homedir();
  const alternates = [
    join(home, 'Documents', 'ComfyUI', 'output'),
    join(home, 'ComfyUI', 'output'),
    join(home, 'AppData', 'Local', 'ComfyUI', 'output'),
  ];
  for (const p of alternates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function createApiRouter(adapterRegistry: AdapterRegistry): Router {
  const router = Router();

  // Build cloud adapter registry from stored API keys
  const cloudProviders = dbOperations.getCollection<any>('cloudProviders');
  const apiKeys: Record<string, string> = {};
  for (const provider of cloudProviders) {
    if (provider.apiKey) {
      apiKeys[provider.id] = decrypt(provider.apiKey);
    }
  }
  const cloudAdapterRegistry = createCloudAdapterRegistry(apiKeys);

  const helpers = createApiRouteHelpers(router);
  const workflowServices = createWorkflowServices(adapterRegistry, {
    now: helpers.now,
    addActivity: helpers.addActivity,
  }, cloudAdapterRegistry);

  registerApiRoutes({
    router,
    adapterRegistry,
    ...helpers,
    ...workflowServices,
  });

  // Workflow ComfyUI manifest route
  router.use('/workflows', createWorkflowComfyUIRouter());

  // Cloud providers routes
  router.use('/cloud-providers', createCloudProvidersRouter());

  // Storage routes
  router.use('/storage', createStorageRouter());

  // Chat session/message CRUD
  router.use('/chat', createChatRouter());
  router.use('/chat/folders', createFolderRouter());

  // Static file serving for output directories
  const lofiaistudioOutputs = join(homedir(), '.lofiaistudio', 'outputs');
  if (existsSync(lofiaistudioOutputs)) {
    router.use('/files/lofoaistudio', express.static(lofiaistudioOutputs));
  }
  const comfyuiOutput = resolveComfyUIPath();
  if (comfyuiOutput) {
    console.log(`Serving ComfyUI output from: ${comfyuiOutput}`);
    router.use('/files/comfyui', express.static(comfyuiOutput));
  } else {
    console.log('ComfyUI output directory not found at any known location');
  }

  return router;
}
