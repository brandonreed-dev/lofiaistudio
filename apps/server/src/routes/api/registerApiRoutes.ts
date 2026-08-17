import type { Request, Response } from 'express';
// runtime imports from @lofiaistudio/shared are loaded dynamically inside handlers to avoid top-level
// module resolution during test discovery/refactor. Type-only imports remain below.
import type { ApiResponse, RuntimeStatus, Model, Modality, RuntimeType, AppSettings, TextGenerationParams, ImageGenerationParams, AudioParams, VideoGenerationParams, Model3DGenerationParams, ChatMessage, Agent, Workflow, WorkflowNode, WorkflowEdge, WorkflowRun, WorkflowResult, Skill, TaskSchedule, ActivityEvent, Project, Integration, Webhook, DashboardSummary, StudioResponseRequest } from '@lofiaistudio/shared';
import { v4 as uuidv4 } from 'uuid';
import { dbOperations, saveDatabase } from '../../db/index.js';
import { executeHttpSkillRequest } from '../../httpSkillExecutor.js';
import { runStudioAudioSpeech, runStudioAudioTranscription, runStudioResponse } from '../../responses.js';
import type { ApiRouterContext } from './context.js';

// Simple adapter/model match helpers (no import needed, just shape)
// Types are duck-typed inline to avoid module resolution issues
interface VideoModelMatch {
  adapter: { isConnected(): boolean; getSupportedModalities(): string[]; getModels(): Promise<unknown[]>; textToVideo(id: string, p: string, params: unknown): Promise<{ videoFile: string; duration: number; frames: number }>;
    imageToVideo(id: string, p: string, ref: string, params: unknown): Promise<{ videoFile: string; duration: number; frames: number }>; };
  model: { id: string; modality: string; runtime: string; };
}
interface AudioModelMatch {
  adapter: { isConnected(): boolean; getSupportedModalities(): string[]; getModels(): Promise<unknown[]>; transcribe(id: string, data: string, params: unknown): Promise<{ text: string; duration: number }>;
    synthesize(id: string, text: string, params: unknown): Promise<{ audioFile: string; duration: number }>; };
  model: { id: string; modality: string; runtime: string; type?: string; };
}

export function registerApiRoutes(context: ApiRouterContext, options?: { loadShared?: () => Promise<any> }): void {
  // Lazy loader for runtime helpers from shared package. Use inside async handlers when needed.
  const loadShared = options?.loadShared ?? (async () => await import('@lofiaistudio/shared'));
  const { router, adapterRegistry, respond, fail, addActivity, createCrudRoutes, runWorkflow, now } = context;

  // Helper: find a video model by ID, optionally scoped to a runtime
  const getVideoModel = async (modelId: string, runtime?: RuntimeType): Promise<VideoModelMatch | undefined> => {
    const match = await adapterRegistry.findModel(modelId, runtime);
    if (!match) return undefined;
    if (match.model.modality !== 'video') return undefined;
    if (!match.adapter.getSupportedModalities().includes('video')) return undefined;
    return { adapter: match.adapter, model: match.model } as unknown as VideoModelMatch;
  };

  // Helper: find an audio model by ID, optionally scoped to a runtime
  const getAudioModel = async (modelId: string, runtime?: RuntimeType): Promise<AudioModelMatch | undefined> => {
    const match = await adapterRegistry.findModel(modelId, runtime);
    if (!match) return undefined;
    if (match.model.modality !== 'audio') return undefined;
    if (!match.adapter.getSupportedModalities().includes('audio')) return undefined;
    return { adapter: match.adapter, model: match.model } as unknown as AudioModelMatch;
  };

  router.get('/runtimes', async (req: Request, res: Response) => {
    try {
      const statuses = await adapterRegistry.getStatuses();
      const response: ApiResponse<RuntimeStatus[]> = {
        success: true,
        data: statuses,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Connect to all runtimes
  router.post('/runtimes/connect', async (req: Request, res: Response) => {
    try {
      const statuses = await adapterRegistry.connectAll();
      const response: ApiResponse<RuntimeStatus[]> = {
        success: true,
        data: statuses,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // ============================================
  // Model Routes
  // ============================================
  
  // Get all models for a modality
  router.get('/models/:modality', async (req: Request, res: Response) => {
    try {
      const modality = req.params.modality as Modality;
      const models: Model[] = [];
      
      for (const adapter of adapterRegistry.getAll()) {
        if (adapter.getSupportedModalities().includes(modality)) {
          const adapterModels = await adapter.getModels();
          models.push(...adapterModels.filter((model) => model.modality === modality));
        }
      }
      
      const response: ApiResponse<Model[]> = {
        success: true,
        data: models,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Load a model
  router.post('/models/:runtime/:modelId/load', async (req: Request, res: Response) => {
    try {
      const { runtime, modelId } = req.params;
      const adapter = adapterRegistry.get(runtime as RuntimeType);
      
      if (!adapter) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Unknown runtime: ${runtime}`,
        };
        return res.status(404).json(response);
      }
      
      const success = await adapter.loadModel(decodeURIComponent(modelId));
      const response: ApiResponse<boolean> = {
        success: true,
        data: success,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Unload a model
  router.post('/models/:runtime/:modelId/unload', async (req: Request, res: Response) => {
    try {
      const { runtime, modelId } = req.params;
      const adapter = adapterRegistry.get(runtime as RuntimeType);
      
      if (!adapter) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Unknown runtime: ${runtime}`,
        };
        return res.status(404).json(response);
      }
      
      const success = await adapter.unloadModel(decodeURIComponent(modelId));
      const response: ApiResponse<boolean> = {
        success: true,
        data: success,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // ============================================
  // Responses Route
  // ============================================

  router.post('/responses', async (req: Request, res: Response) => {
    try {
      const response = await runStudioResponse(adapterRegistry, req.body as StudioResponseRequest);
      respond(res, response);
    } catch (error) {
      fail(res, error);
    }
  });

  // ============================================
  // Text Generation Routes
  // ============================================
  
  // Chat completion
  router.post('/text/chat', async (req: Request, res: Response) => {
    try {
      const { modelId, messages, params } = req.body as {
        modelId: string;
        messages: ChatMessage[];
        params: TextGenerationParams;
      };
      
      const { chatToResponseRequest, responseOutputText } = await loadShared();
      const studioResponse = await runStudioResponse(
        adapterRegistry,
        chatToResponseRequest({ modelId, messages, params })
      );
      const result = responseOutputText(studioResponse);
      addActivity({
        type: 'runtime.text.completed',
        title: 'Text generation completed',
        message: `${studioResponse.runtime ?? 'local'} completed a chat request with ${modelId}.`,
        tone: 'green',
        entityType: 'runtime',
        entityId: studioResponse.runtime ?? 'local',
      });
      const response: ApiResponse<{ text: string }> = {
        success: true,
        data: { text: result },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Completion
  router.post('/text/complete', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, params } = req.body as {
        modelId: string;
        prompt: string;
        params: TextGenerationParams;
      };
      
      const studioResponse = await runStudioResponse(
        adapterRegistry,
        (await loadShared()).completionToResponseRequest({ modelId, prompt, params })
      );
      const result = (await loadShared()).responseOutputText(studioResponse);
      addActivity({
        type: 'runtime.text.completed',
        title: 'Text completion completed',
        message: `${studioResponse.runtime ?? 'local'} completed a prompt with ${modelId}.`,
        tone: 'green',
        entityType: 'runtime',
        entityId: studioResponse.runtime ?? 'local',
      });
      const response: ApiResponse<{ text: string }> = {
        success: true,
        data: { text: result },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // ============================================
  // Image Generation Routes
  // ============================================
  
  // Text-to-image generation
  router.post('/image/text-to-image', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, negativePrompt, params } = req.body as {
        modelId: string;
        prompt: string;
        negativePrompt: string | null;
        params: ImageGenerationParams;
      };
      
      const studioResponse = await runStudioResponse(
        adapterRegistry,
        (await loadShared()).imageToResponseRequest({ modelId, prompt, negativePrompt, params })
      );
      const result = (await loadShared()).responseImages(studioResponse);
      addActivity({
        type: 'runtime.image.completed',
        title: 'Image generation completed',
        message: `${studioResponse.runtime ?? 'local'} generated ${result.images.length} image${result.images.length === 1 ? '' : 's'}.`,
        tone: 'pink',
        entityType: 'runtime',
        entityId: studioResponse.runtime ?? 'local',
      });
      const response: ApiResponse<{ images: string[]; seeds: number[] }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Image-to-image transformation
  router.post('/image/image-to-image', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, negativePrompt, referenceImage, params } = req.body as {
        modelId: string;
        prompt: string;
        negativePrompt: string | null;
        referenceImage: string;
        params: ImageGenerationParams;
      };
      
      const studioResponse = await runStudioResponse(
        adapterRegistry,
        (await loadShared()).imageToResponseRequest({ modelId, prompt, negativePrompt, referenceImage, params })
      );
      const result = (await loadShared()).responseImages(studioResponse);
      addActivity({
        type: 'runtime.image.completed',
        title: 'Image transformation completed',
        message: `${studioResponse.runtime ?? 'local'} transformed an image with ${modelId}.`,
        tone: 'pink',
        entityType: 'runtime',
        entityId: studioResponse.runtime ?? 'local',
      });
      const response: ApiResponse<{ images: string[]; seeds: number[] }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // ============================================
  // Video Routes
  // ============================================

  router.post('/video/text-to-video', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, params, runtime } = req.body as {
        modelId: string;
        prompt: string;
        params: VideoGenerationParams;
        runtime?: RuntimeType;
      };

      const match = await getVideoModel(modelId, runtime);
      if (!match) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Video model not found: ${modelId}`,
        };
        return res.status(404).json(response);
      }

      if (match.model.modality !== 'video') {
        const response: ApiResponse<null> = {
          success: false,
          error: `Model ${modelId} does not support video generation`,
        };
        return res.status(400).json(response);
      }

      if (!match.adapter.isConnected()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `${match.model.runtime} adapter not connected`,
        };
        return res.status(503).json(response);
      }

      const result = await match.adapter.textToVideo(modelId, prompt, params);
      addActivity({
        type: 'runtime.video.completed',
        title: 'Video generation completed',
        message: `ComfyUI rendered ${result.frames} frames with ${modelId}.`,
        tone: 'purple',
        entityType: 'runtime',
        entityId: String(match.model.runtime),
      });
      const response: ApiResponse<{ videoFile: string; duration: number; frames: number }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });

  router.post('/video/image-to-video', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, referenceImage, params, runtime } = req.body as {
        modelId: string;
        prompt: string;
        referenceImage: string;
        params: VideoGenerationParams;
        runtime?: RuntimeType;
      };

      const match = await getVideoModel(modelId, runtime);
      if (!match) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Video model not found: ${modelId}`,
        };
        return res.status(404).json(response);
      }

      if (match.model.modality !== 'video') {
        const response: ApiResponse<null> = {
          success: false,
          error: `Model ${modelId} does not support video generation`,
        };
        return res.status(400).json(response);
      }

      if (!match.adapter.isConnected()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `${match.model.runtime} adapter not connected`,
        };
        return res.status(503).json(response);
      }

      const result = await match.adapter.imageToVideo(modelId, prompt, referenceImage, params);
      addActivity({
        type: 'runtime.video.completed',
        title: 'Image-to-video completed',
        message: `ComfyUI rendered ${result.frames} frames with ${modelId}.`,
        tone: 'purple',
        entityType: 'runtime',
        entityId: String(match.model.runtime),
      });
      const response: ApiResponse<{ videoFile: string; duration: number; frames: number }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });

  // ============================================
  // 3D Model Routes
  // ============================================

  // Text-to-3D generation
  router.post('/3d/text-to-3d', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, negativePrompt, params } = req.body as {
        modelId: string;
        prompt: string;
        negativePrompt: string | null;
        params: Model3DGenerationParams;
      };

      const studioResponse = await runStudioResponse(
        adapterRegistry,
        (await loadShared()).model3DToResponseRequest({ modelId, prompt, negativePrompt, params })
      );
      const result = (await loadShared()).responseModel3D(studioResponse);
      addActivity({
        type: 'runtime.3d.completed',
        title: '3D model generation completed',
        message: `${studioResponse.runtime ?? 'local'} generated ${result.modelFiles.length} 3D model${result.modelFiles.length === 1 ? '' : 's'}.`,
         tone: 'amber',
        entityType: 'runtime',
        entityId: studioResponse.runtime ?? 'local',
      });
      const response: ApiResponse<{ modelFiles: string[]; seeds: number[] }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });

  // Image-to-3D generation
  router.post('/3d/image-to-3d', async (req: Request, res: Response) => {
    try {
      const { modelId, prompt, negativePrompt, referenceImage, params } = req.body as {
        modelId: string;
        prompt: string;
        negativePrompt: string | null;
        referenceImage: string;
        params: Model3DGenerationParams;
      };

      const studioResponse = await runStudioResponse(
        adapterRegistry,
        (await loadShared()).model3DToResponseRequest({ modelId, prompt, negativePrompt, referenceImage, params })
      );
      const result = (await loadShared()).responseModel3D(studioResponse);
      addActivity({
        type: 'runtime.3d.completed',
        title: 'Image-to-3D completed',
        message: `${studioResponse.runtime ?? 'local'} generated a 3D model from an image with ${modelId}.`,
        tone: 'amber',
        entityType: 'runtime',
        entityId: studioResponse.runtime ?? 'local',
      });
      const response: ApiResponse<{ modelFiles: string[]; seeds: number[] }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });

  // ============================================
  // Audio Routes
  // ============================================
  
  // Speech-to-text (transcription)
  router.post('/audio/transcribe', async (req: Request, res: Response) => {
    try {
      const { modelId, audioData, params } = req.body as {
        modelId: string;
        audioData: string;
        params: AudioParams;
        runtime?: RuntimeType;
      };
      
      const match = await getAudioModel(modelId, req.body.runtime);
      if (!match) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Audio STT model not found: ${modelId}`,
        };
        return res.status(404).json(response);
      }

      if (match.model.modality !== 'audio' || match.model.type !== 'stt') {
        const response: ApiResponse<null> = {
          success: false,
          error: `Model ${modelId} does not support speech-to-text`,
        };
        return res.status(400).json(response);
      }

      if (!match.adapter.isConnected()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `${match.model.runtime} adapter not connected`,
        };
        return res.status(503).json(response);
      }

      const result = await match.adapter.transcribe(modelId, audioData, params);
      addActivity({
        type: 'runtime.audio.transcribed',
        title: 'Audio transcribed',
        message: `${match.model.runtime} transcribed ${result.duration.toFixed(1)}s of audio.`,
        tone: 'cyan',
        entityType: 'runtime',
        entityId: String(match.model.runtime),
      });
      const response: ApiResponse<{ text: string; duration: number }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Text-to-speech (synthesis)
  router.post('/audio/synthesize', async (req: Request, res: Response) => {
    try {
      const { modelId, text, params } = req.body as {
        modelId: string;
        text: string;
        params: AudioParams;
        runtime?: RuntimeType;
      };
      
      const match = await getAudioModel(modelId, req.body.runtime);
      if (!match) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Audio TTS model not found: ${modelId}`,
        };
        return res.status(404).json(response);
      }

      if (match.model.modality !== 'audio' || match.model.type !== 'tts') {
        const response: ApiResponse<null> = {
          success: false,
          error: `Model ${modelId} does not support text-to-speech`,
        };
        return res.status(400).json(response);
      }

      if (!match.adapter.isConnected()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `${match.model.runtime} adapter not connected`,
        };
        return res.status(503).json(response);
      }

      const result = await match.adapter.synthesize(modelId, text, params);
      addActivity({
        type: 'runtime.audio.synthesized',
        title: 'Speech synthesized',
        message: `${match.model.runtime} generated ${result.duration.toFixed(1)}s of audio.`,
        tone: 'cyan',
        entityType: 'runtime',
        entityId: String(match.model.runtime),
      });
      const response: ApiResponse<{ audioFile: string; duration: number }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // ============================================
  // Backward-Compatible Audio Routes
  // (Legacy endpoints used by VoiceInput/VoiceOutput components)
  // ============================================

  // Legacy STT endpoint (JSON only — accepts base64 audio data)
  router.post('/stt', async (req: Request, res: Response) => {
    try {
      const body = req.body as { model?: string; file?: string; audio?: string; modelId?: string; audioData?: string; language?: string };
      const modelId = body.model || body.modelId || 'qwen3-asr';
      const language = body.language || 'auto';
      let audioData = body.file || body.audio || body.audioData || '';
      
      if (!audioData) {
        const response: ApiResponse<null> = { success: false, error: 'No audio data provided' };
        return res.status(400).json(response);
      }
      
      // If it's raw base64 (not a data URL), wrap it
      if (!audioData.startsWith('data:')) {
        audioData = `data:audio/wav;base64,${audioData}`;
      }

      // Delegate to the same logic as /api/audio/transcribe
      const match = await getAudioModel(modelId, undefined);
      if (!match) {
        const response: ApiResponse<null> = { success: false, error: `Audio STT model not found: ${modelId}` };
        return res.status(404).json(response);
      }
      if (match.model.modality !== 'audio' || match.model.type !== 'stt') {
        const response: ApiResponse<null> = { success: false, error: `Model ${modelId} does not support speech-to-text` };
        return res.status(400).json(response);
      }
      if (!match.adapter.isConnected()) {
        const response: ApiResponse<null> = { success: false, error: `${match.model.runtime} adapter not connected` };
        return res.status(503).json(response);
      }

      const result = await match.adapter.transcribe(modelId, audioData, { language, translate: false });
      addActivity({
        type: 'runtime.audio.transcribed',
        title: 'Audio transcribed',
        message: `${match.model.runtime} transcribed ${result.duration.toFixed(1)}s of audio.`,
        tone: 'cyan',
        entityType: 'runtime',
        entityId: String(match.model.runtime),
      });
      const response: ApiResponse<{ text: string; duration: number }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });

  // Legacy TTS endpoint
  router.post('/tts', async (req: Request, res: Response) => {
    try {
      const { text, model, modelId, speed } = req.body as {
        text: string;
        model?: string;
        modelId?: string;
        speed?: number;
      };

      const resolvedModelId = model || modelId || 'default';

      // Delegate to the same logic as /api/audio/synthesize
      const match = await getAudioModel(resolvedModelId, undefined);
      if (!match) {
        const response: ApiResponse<null> = { success: false, error: `Audio TTS model not found: ${resolvedModelId}` };
        return res.status(404).json(response);
      }
      if (match.model.modality !== 'audio' || match.model.type !== 'tts') {
        const response: ApiResponse<null> = { success: false, error: `Model ${resolvedModelId} does not support text-to-speech` };
        return res.status(400).json(response);
      }
      if (!match.adapter.isConnected()) {
        const response: ApiResponse<null> = { success: false, error: `${match.model.runtime} adapter not connected` };
        return res.status(503).json(response);
      }

      const result = await match.adapter.synthesize(resolvedModelId, text, {
        speed: speed || 1.0,
        pitch: 1.0,
        outputFormat: 'wav',
      });
      addActivity({
        type: 'runtime.audio.synthesized',
        title: 'Speech synthesized',
        message: `${match.model.runtime} generated ${result.duration.toFixed(1)}s of audio.`,
        tone: 'cyan',
        entityType: 'runtime',
        entityId: String(match.model.runtime),
      });
      const response: ApiResponse<{ audioFile: string; duration: number; audioUrl?: string }> = {
        success: true,
        data: { ...result, audioUrl: result.audioFile },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });

  // ============================================
  // Orchestration Routes
  // ============================================

  createCrudRoutes<Agent>('/agents', 'agents');
  createCrudRoutes<Workflow>('/workflows', 'workflows');

  router.post('/skills/:id/execute', async (req: Request, res: Response) => {
    try {
      const skill = dbOperations.getCollection<Skill>('skills').find((s) => s.id === req.params.id);
      if (!skill || !skill.enabled) {
        return fail(res, 'Skill not found or disabled', 404);
      }
      if (skill.executionType !== 'http' || !skill.endpoint?.trim()) {
        return fail(res, 'Not an HTTP skill or missing endpoint', 400);
      }
      const bodyInput = (req.body?.input ?? {}) as Record<string, unknown>;
      const { status, result } = await executeHttpSkillRequest(skill, bodyInput, undefined);
      respond(res, { status, result });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : error, 400);
    }
  });

  createCrudRoutes<Skill>('/skills', 'skills');
  createCrudRoutes<TaskSchedule>('/tasks', 'tasks');

  createCrudRoutes<Project>('/projects', 'projects');

  router.get('/projects/:projectId/summary', async (req: Request, res: Response) => {
    try {
      const project = dbOperations.getCollection<Project>('projects').find((p) => p.id === req.params.projectId);
      if (!project) return fail(res, 'Project not found', 404);
      const workflows = dbOperations.getCollection<Workflow>('workflows').filter((w) => w.project === project.id);
      const agents = dbOperations.getCollection<Agent>('agents').filter((a) => a.project === project.id);
      const activity = dbOperations.getCollection<ActivityEvent>('activity').filter((a) => a.projectId === project.id);
      const summary = {
        project,
        workflows: workflows.length,
        agents: agents.length,
        activity: activity.slice(0, 20),
      };
      respond(res, summary);
    } catch (error) {
      fail(res, error);
    }
  });
  createCrudRoutes<Integration>('/integrations', 'integrations');
  createCrudRoutes<Webhook>('/webhooks', 'webhooks');

  // Webhook trigger endpoint: POST /api/webhooks/trigger/:token
  router.post('/webhooks/trigger/:token', async (req: Request, res: Response) => {
    try {
      const webhooks = dbOperations.getCollection<Webhook>('webhooks');
      const webhook = webhooks.find((w) => w.token === req.params.token && w.enabled);
      if (!webhook) return fail(res, 'Webhook not found or disabled', 404);

      const workflow = dbOperations
        .getCollection<Workflow>('workflows')
        .find((entry) => entry.id === webhook.workflowId);
      if (!workflow) return fail(res, `Workflow not found: ${webhook.workflowId}`, 404);

      // Fire-and-forget: run the workflow in the background
      runWorkflow(workflow, 'task', req.body).catch((err) =>
        console.error(`Webhook run failed: ${err}`)
      );

      // Update last triggered timestamp
      dbOperations.updateInCollection<Webhook>('webhooks', webhook.id, {
        lastTriggeredAt: now(),
      } as Partial<Webhook>);

      addActivity({
        type: 'webhook.triggered',
        title: 'Webhook triggered',
        message: `Webhook "${webhook.name}" triggered workflow "${workflow.name}".`,
        tone: 'purple',
        entityType: 'webhook',
        entityId: webhook.id,
      });

      respond(res, { accepted: true, workflowName: workflow.name });
    } catch (error) {
      fail(res, error);
    }
  });

  // ============================================
  // Workflow Version Routes
  // ============================================
  
  function saveDbToDisk(): void {
    try {
      const { writeFileSync, readFileSync } = require('fs');
      const { join } = require('path');
      const { homedir } = require('os');
      dbOperations as any; // ensure it's referenced
      // Direct file write: read current, merge versions in, write back
      const path = join(homedir(), '.lofiaistudio', 'lofiaistudio.json');
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      data.workflowVersions = (dbOperations as any).workflowVersions ?? [];
      writeFileSync(path, JSON.stringify(data, null, 2));
    } catch {}
  }
  
  // Save a version snapshot for a workflow
  router.post('/workflows/:workflowId/versions', async (req: Request, res: Response) => {
    try {
      const workflow = dbOperations
        .getCollection<Workflow>('workflows')
        .find((entry) => entry.id === req.params.workflowId);
      if (!workflow) return fail(res, `Workflow not found: ${req.params.workflowId}`, 404);
      
      const rawDb = dbOperations as unknown as { workflowVersions: Record<string, unknown>[] };
      const versions = rawDb.workflowVersions ?? [];
      const existing = versions.filter((v: Record<string, unknown>) => v.workflowId === workflow.id);
      const maxVer = existing.reduce((max: number, v: Record<string, unknown>) => Math.max(max, Number(v.versionNumber ?? 0)), 0);
      
      const version = {
        id: uuidv4(),
        workflowId: workflow.id,
        versionNumber: maxVer + 1,
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
        enabled: workflow.enabled,
        message: req.body.message ?? undefined,
        createdAt: now(),
      };
      
      rawDb.workflowVersions = [...versions, version];
      saveDbToDisk();
      
      respond(res, version, 201);
    } catch (error) {
      fail(res, error);
    }
  });

  // List versions for a workflow
  router.get('/workflows/:workflowId/versions', async (req: Request, res: Response) => {
    try {
      const rawDb = dbOperations as unknown as { workflowVersions: Record<string, unknown>[] };
      const versions = (rawDb.workflowVersions ?? [])
        .filter((v: Record<string, unknown>) => v.workflowId === req.params.workflowId)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
          Number(b.versionNumber ?? 0) - Number(a.versionNumber ?? 0)
        );
      respond(res, versions);
    } catch (error) {
      fail(res, error);
    }
  });

  // Restore a specific version
  router.post('/workflows/:workflowId/versions/:versionId/restore', async (req: Request, res: Response) => {
    try {
      const rawDb = dbOperations as unknown as { workflowVersions: Record<string, unknown>[] };
      const version = (rawDb.workflowVersions ?? [])
        .find((v: Record<string, unknown>) => v.id === req.params.versionId && v.workflowId === req.params.workflowId);
      if (!version) return fail(res, 'Version not found', 404);
      
      const updated = dbOperations.updateInCollection<Workflow>('workflows', req.params.workflowId, {
        nodes: version.nodes as WorkflowNode[],
        edges: version.edges as WorkflowEdge[],
        updatedAt: now(),
      } as Partial<Workflow>);
      
      if (!updated) return fail(res, 'Workflow not found', 404);
      
      addActivity({
        type: 'workflow.version.restored',
        title: 'Version restored',
        message: `"${updated.name}" restored to v${version.versionNumber}.`,
        tone: 'purple',
        entityType: 'workflow',
        entityId: updated.id,
      });
      
      respond(res, updated);
    } catch (error) {
      fail(res, error);
    }
  });
  
  router.post('/workflows/:id/run', async (req: Request, res: Response) => {
    try {
      const workflow = dbOperations
        .getCollection<Workflow>('workflows')
        .find((entry) => entry.id === req.params.id);
      if (!workflow) return fail(res, `Workflow not found: ${req.params.id}`, 404);
      const run = await runWorkflow(workflow, req.body.trigger ?? 'manual', req.body.input);
      respond(res, run, 201);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/workflow-results', (_req: Request, res: Response) => {
    const results = dbOperations
      .getCollection<WorkflowResult>('workflowResults')
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    respond(res, results);
  });

  router.get('/workflow-runs', (_req: Request, res: Response) => {
    const runs = dbOperations
      .getCollection<WorkflowRun>('workflowRuns')
      .slice()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    respond(res, runs);
  });

  router.post('/tasks/:id/run', async (req: Request, res: Response) => {
    try {
      const task = dbOperations.getCollection<TaskSchedule>('tasks').find((entry) => entry.id === req.params.id);
      if (!task) return fail(res, `Task not found: ${req.params.id}`, 404);
      if (!task.workflowId) return fail(res, `Task ${task.id} has no workflowId`, 400);
      const workflow = dbOperations.getCollection<Workflow>('workflows').find((entry) => entry.id === task.workflowId);
      if (!workflow) return fail(res, `Workflow not found for task: ${task.workflowId}`, 404);
      const run = await runWorkflow(workflow, 'task', { taskId: task.id, ...req.body.input });
      dbOperations.updateInCollection<TaskSchedule>('tasks', task.id, {
        lastRunAt: run.completedAt ?? run.startedAt,
        lastStatus: run.status,
        updatedAt: now(),
      });
      respond(res, run, 201);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/activity', (req: Request, res: Response) => {
    const {
      q,
      type,
      projectId,
      workspaceId,
      repoId,
      userId,
      environment,
      from,
      to,
      limit = '200',
    } = req.query as Record<string, string | undefined>;

    let collection = dbOperations.getCollection<ActivityEvent>('activity').slice();

    if (q) {
      const query = q.toLowerCase();
      collection = collection.filter((item) =>
        [item.title, item.message, item.type, item.entityType].some((field) =>
          String(field ?? '')
            .toLowerCase()
            .includes(query)
        )
      );
    }
    if (type) {
      const types = type.split(',').map((value) => value.trim());
      collection = collection.filter((item) => types.includes(item.type));
    }
    if (projectId) collection = collection.filter((item) => item.projectId === projectId);
    if (workspaceId) collection = collection.filter((item) => item.workspaceId === workspaceId);
    if (repoId) collection = collection.filter((item) => item.repoId === repoId);
    if (userId) collection = collection.filter((item) => item.userId === userId);
    if (environment) collection = collection.filter((item) => item.environment === environment);
    if (from) collection = collection.filter((item) => item.createdAt >= from);
    if (to) collection = collection.filter((item) => item.createdAt <= to);

    const limitValue = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    const sorted = collection.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    respond(res, sorted.slice(0, limitValue));
  });

  router.get('/dashboard/summary', async (_req: Request, res: Response) => {
    try {
      const [runtimes, agents, workflows, skills, tasks, activity, runs] = await Promise.all([
        adapterRegistry.getStatuses(),
        Promise.resolve(dbOperations.getCollection<Agent>('agents')),
        Promise.resolve(dbOperations.getCollection<Workflow>('workflows')),
        Promise.resolve(dbOperations.getCollection<Skill>('skills')),
        Promise.resolve(dbOperations.getCollection<TaskSchedule>('tasks')),
        Promise.resolve(
          dbOperations
            .getCollection<ActivityEvent>('activity')
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        ),
        Promise.resolve(
          dbOperations
            .getCollection<WorkflowRun>('workflowRuns')
            .slice()
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        ),
      ]);
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const enabledTasks = tasks.filter((task) => task.enabled);
      const nextRunAt = enabledTasks
        .map((task) => task.nextRunAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0];
      const summary: DashboardSummary = {
        agents: {
          total: agents.length,
          active: agents.filter((agent) => agent.status === 'active' || agent.status === 'busy').length,
        },
        workflows: {
          total: workflows.length,
          runs24h: runs.filter((run) => Date.parse(run.startedAt) >= dayAgo).length,
          running: runs.filter((run) => run.status === 'running' || run.status === 'pending').length,
        },
        tasks: {
          total: tasks.length,
          enabled: enabledTasks.length,
          nextRunAt,
        },
        skills: {
          total: skills.length,
          enabled: skills.filter((skill) => skill.enabled).length,
        },
        runtimes: {
          total: runtimes.length,
          connected: runtimes.filter((runtime) => runtime.connected).length,
          models: runtimes.reduce((sum, runtime) => sum + runtime.models.length, 0),
        },
        activity: activity.slice(0, 12),
        recentRuns: runs.slice(0, 8),
      };
      respond(res, summary);
    } catch (error) {
      fail(res, error);
    }
  });

  // ============================================
  // Inbox Routes
  // ============================================

  router.get('/inbox/accounts', async (req: Request, res: Response) => {
    try {
      const accounts = dbOperations.getCollection<Record<string, unknown>>('inboxAccounts');
      respond(res, accounts);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/inbox/messages', async (req: Request, res: Response) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const folder = req.query.folder as string | undefined;
      let messages = dbOperations.getCollection<Record<string, unknown>>('inboxMessages');
      if (accountId) messages = messages.filter((m) => m.accountId === accountId);
      if (folder) messages = messages.filter((m) => m.folder === folder);
      messages = messages.sort((a, b) => ((a.createdAt as string) > (b.createdAt as string) ? -1 : 1));
      respond(res, messages);
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/inbox/messages/:id/read', async (req: Request, res: Response) => {
    try {
      const { read } = req.body as { read: boolean };
      const updated = dbOperations.updateInCollection<any>('inboxMessages', req.params.id, { read, updatedAt: now() });
      respond(res, updated ?? { success: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/inbox/messages/:id/star', async (req: Request, res: Response) => {
    try {
      const { starred } = req.body as { starred: boolean };
      const updated = dbOperations.updateInCollection<any>('inboxMessages', req.params.id, { starred, updatedAt: now() });
      respond(res, updated ?? { success: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/inbox/messages/:id/move', async (req: Request, res: Response) => {
    try {
      const { folder } = req.body as { folder: string };
      const updated = dbOperations.updateInCollection<any>('inboxMessages', req.params.id, { folder, updatedAt: now() });
      respond(res, updated ?? { success: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/inbox/summary', async (req: Request, res: Response) => {
    try {
      const messages = dbOperations.getCollection<Record<string, unknown>>('inboxMessages');
      const totalUnread = messages.filter((m) => !m.read).length;
      const totalStarred = messages.filter((m) => m.starred).length;
      const accounts = dbOperations.getCollection<Record<string, unknown>>('inboxAccounts');
      const accountSummaries = accounts.map((account) => {
        const accountMessages = messages.filter((m) => m.accountId === account.id);
        return {
          accountId: account.id,
          label: account.label,
          provider: account.provider,
          unread: accountMessages.filter((m) => !m.read).length,
        };
      });
      respond(res, { totalUnread, totalStarred, accounts: accountSummaries });
    } catch (error) {
      fail(res, error);
    }
  });

  // ============================================
  // Organizations Routes
  // ============================================

  router.get('/organizations', async (req: Request, res: Response) => {
    try {
      const organizations = dbOperations.getCollection<Record<string, unknown>>('organizations');
      respond(res, organizations);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/organizations/:id', async (req: Request, res: Response) => {
    try {
      const organization = dbOperations.getCollection<Record<string, unknown>>('organizations').find((o) => o.id === req.params.id);
      if (!organization) return fail(res, 'Organization not found', 404);
      respond(res, organization);
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/organizations', async (req: Request, res: Response) => {
    try {
      const organization = dbOperations.addToCollection<any>('organizations', {
        id: uuidv4(),
        ...req.body,
        createdAt: now(),
        updatedAt: now(),
      });
      respond(res, organization, 201);
    } catch (error) {
      fail(res, error);
    }
  });

  router.put('/organizations/:id', async (req: Request, res: Response) => {
    try {
      const updated = dbOperations.updateInCollection<any>('organizations', req.params.id, {
        ...req.body,
        updatedAt: now(),
      });
      if (!updated) return fail(res, 'Organization not found', 404);
      respond(res, updated);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete('/organizations/:id', async (req: Request, res: Response) => {
    try {
      const deleted = dbOperations.deleteFromCollection('organizations', req.params.id);
      if (!deleted) return fail(res, 'Organization not found', 404);
      respond(res, { success: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/organizations/:orgId/members', async (req: Request, res: Response) => {
    try {
      const members = dbOperations.getCollection<Record<string, unknown>>('organizationMembers').filter((m) => m.orgId === req.params.orgId);
      respond(res, members);
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/organizations/:orgId/members', async (req: Request, res: Response) => {
    try {
      const member = dbOperations.addToCollection<any>('organizationMembers', {
        id: uuidv4(),
        orgId: req.params.orgId,
        ...req.body,
        joinedAt: now(),
      });
      respond(res, member, 201);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete('/organizations/:orgId/members/:userId', async (req: Request, res: Response) => {
    try {
      const members = dbOperations.getCollection<Record<string, unknown>>('organizationMembers');
      const index = members.findIndex((m) => m.orgId === req.params.orgId && m.userId === req.params.userId);
      if (index === -1) return fail(res, 'Member not found', 404);
      members.splice(index, 1);
      respond(res, { success: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.put('/organizations/:orgId/members/:userId', async (req: Request, res: Response) => {
    try {
      const members = dbOperations.getCollection<Record<string, unknown>>('organizationMembers');
      const index = members.findIndex((m) => m.orgId === req.params.orgId && m.userId === req.params.userId);
      if (index === -1) return fail(res, 'Member not found', 404);
      members[index] = { ...members[index], ...req.body, updatedAt: now() };
      respond(res, members[index]);
    } catch (error) {
      fail(res, error);
    }
  });

  // ============================================
  // Settings Routes
  // ============================================
  
  // Get settings
  router.get('/settings', async (req: Request, res: Response) => {
    try {
      const response: ApiResponse<AppSettings> = {
        success: true,
        data: dbOperations.getSetting<AppSettings>('app')!,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
  // Update settings
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const current = dbOperations.getSetting<AppSettings>('app')!;
      const settings = { ...current, ...(req.body as Partial<AppSettings>) };
      dbOperations.setSetting('app', settings);
      const response: ApiResponse<AppSettings> = {
        success: true,
        data: settings,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    }
  });
  
}
