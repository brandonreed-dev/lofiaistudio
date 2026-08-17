import type {
  ImageGenerationParams,
  ImageModel,
  Model,
  Model3DGenerationParams,
  Model3DModel,
  Modality,
  RuntimeStatus,
  VideoGenerationParams,
  VideoModel,
} from '@lofiaistudio/shared';
import { BaseRuntimeAdapter, type ImageAdapter, type VideoAdapter, type Model3DAdapter } from './base.js';
import { v4 as uuidv4 } from 'uuid';

interface ComfyUINode {
  class_type: string;
  inputs: Record<string, unknown>;
}

interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUINode;
}

interface ComfyUIPromptRequest {
  prompt: ComfyUIWorkflow;
  client_id?: string;
}

interface ComfyUIAsset {
  filename: string;
  subfolder: string;
  type: string;
  format?: string;
}

interface ComfyUIHistoryResponse {
  [promptId: string]: {
    outputs: {
      [nodeId: string]: {
        images?: ComfyUIAsset[];
        gifs?: ComfyUIAsset[];
        videos?: ComfyUIAsset[];
        audio?: ComfyUIAsset;
        text?: string;
        meshes?: ComfyUIAsset[];
        glbs?: ComfyUIAsset[];
      };
    };
  };
}

interface CheckpointLoaderInfo {
  CheckpointLoaderSimple?: {
    input?: {
      required?: {
        ckpt_name?: [string[]];
      };
    };
  };
}

interface LoaderInfoResponse {
  UNETLoader?: {
    input?: {
      required?: {
        unet_name?: [string[]];
      };
    };
  };
  CLIPLoader?: {
    input?: {
      required?: {
        clip_name?: [string[]];
      };
    };
  };
  VAELoader?: {
    input?: {
      required?: {
        vae_name?: [string[]];
      };
    };
  };
}

interface WorkflowOutputs {
  images: string[];
  videos: string[];
  models: string[];
}

type ComfyVideoParams = VideoGenerationParams & {
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  scheduler?: string;
  width?: number;
  height?: number;
};

export class ComfyUIAdapter extends BaseRuntimeAdapter implements ImageAdapter, VideoAdapter, Model3DAdapter {
  readonly type = 'comfyui' as const;
  private _clientId: string;

  constructor(endpoint: string = 'http://localhost:8188') {
    super(endpoint);
    this._clientId = uuidv4();
  }

  getSupportedModalities(): Modality[] {
    return ['image', 'video', '3d'];
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this._endpoint}/system_stats`);
      if (response.ok) {
        this._connected = true;
        await this.getModels();
        return true;
      }
    } catch (error) {
      console.error('Failed to connect to ComfyUI:', error);
    }

    this._connected = false;
    return false;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this._models = [];
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const response = await fetch(`${this._endpoint}/system_stats`);
      if (response.ok) {
        const data = (await response.json()) as {
          system: { devices: Array<{ vram_total: number; vram_used: number }> };
        };

        const device = data.system?.devices?.[0];
        const models = await this.getModels();

        return {
          type: this.type,
          connected: true,
          endpoint: this._endpoint,
          models,
          vramUsage: device?.vram_used,
          vramTotal: device?.vram_total,
        };
      }
    } catch (error) {
      console.error('Failed to get ComfyUI status:', error);
    }

    return {
      type: this.type,
      connected: false,
      endpoint: this._endpoint,
      models: [],
    };
  }

  async getModels(): Promise<Model[]> {
    try {
      const [checkpointInfo, unetInfo, clipInfo, vaeInfo] = await Promise.all([
        this.fetchObjectInfo<CheckpointLoaderInfo>('CheckpointLoaderSimple').catch(
          (): CheckpointLoaderInfo => ({})
        ),
        this.fetchObjectInfo<LoaderInfoResponse>('UNETLoader').catch(
          (): LoaderInfoResponse => ({})
        ),
        this.fetchObjectInfo<LoaderInfoResponse>('CLIPLoader').catch(
          (): LoaderInfoResponse => ({})
        ),
        this.fetchObjectInfo<LoaderInfoResponse>('VAELoader').catch(
          (): LoaderInfoResponse => ({})
        ),
      ]);

      const checkpoints =
        checkpointInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
      const unets = unetInfo.UNETLoader?.input?.required?.unet_name?.[0] ?? [];
      const clips = clipInfo.CLIPLoader?.input?.required?.clip_name?.[0] ?? [];
      const vaes = vaeInfo.VAELoader?.input?.required?.vae_name?.[0] ?? [];

      const imageModels: ImageModel[] = checkpoints.map((name: string) => ({
        id: name,
        name: name.replace('.safetensors', '').replace('.ckpt', ''),
        modality: 'image',
        status: 'unloaded',
        runtime: 'comfyui',
        defaultWidth: 512,
        defaultHeight: 512,
        maxBatchSize: 4,
        metadata: {
          filename: name,
        },
      }));

      const wanClip = clips.find((name: string) => name.toLowerCase().includes('umt5'));
      const wanVae = vaes.find(
        (name: string) => name.toLowerCase().includes('wan') && name.toLowerCase().includes('vae')
      );

      const videoModels: VideoModel[] = unets
        .filter((name: string) => {
          const lower = name.toLowerCase();
          return lower.includes('wan') && (lower.includes('ti2v') || lower.includes('i2v') || lower.includes('video'));
        })
        .map((name: string) => ({
          id: name,
          name: name.replace('.safetensors', ''),
          modality: 'video',
          status: 'unloaded',
          runtime: 'comfyui',
          maxFrames: 81,
          defaultFps: 20,
          metadata: {
            filename: name,
            clipName: wanClip ?? clips[0],
            vaeName: wanVae ?? vaes[0],
          },
        }));

      // Discover 3D models from unets — filter for known 3D generation model names
      const model3DKeywords = ['trellis', 'hunyuan3d', 'triposr', 'instantmesh', 'crm', 'wonder3d', '3d'];
      const model3DModels: Model3DModel[] = unets
        .filter((name: string) => {
          const lower = name.toLowerCase();
          // Exclude video models that already matched
          if (lower.includes('wan') && (lower.includes('ti2v') || lower.includes('i2v') || lower.includes('video'))) {
            return false;
          }
          return model3DKeywords.some((kw) => lower.includes(kw));
        })
        .map((name: string) => ({
          id: name,
          name: name.replace('.safetensors', ''),
          modality: '3d',
          status: 'unloaded',
          runtime: 'comfyui',
          defaultFormat: 'glb',
          supportsTexturing: true,
          supportsImageTo3D: true,
          maxBatchSize: 1,
          metadata: {
            filename: name,
            clipName: clips[0],
            vaeName: vaes[0],
          },
        }));

      this._models = [...imageModels, ...videoModels, ...model3DModels];
      return this._models;
    } catch (error) {
      console.error('Failed to fetch ComfyUI models:', error);
      return [];
    }
  }

  async loadModel(modelId: string): Promise<boolean> {
    const model = this._models.find((entry) => entry.id === modelId);
    if (model) {
      model.status = 'loaded';
      return true;
    }
    return false;
  }

  async unloadModel(modelId: string): Promise<boolean> {
    const model = this._models.find((entry) => entry.id === modelId);
    if (model) {
      model.status = 'unloaded';
      return true;
    }
    return false;
  }

  async textToImage(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    params: ImageGenerationParams
  ): Promise<{ images: string[]; seeds: number[] }> {
    const seed = params.seed ?? Math.floor(Math.random() * 2147483647);
    const workflow: ComfyUIWorkflow = {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: modelId,
        },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['1', 1],
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: negativePrompt || '',
          clip: ['1', 1],
        },
      },
      '4': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: params.steps || 20,
          cfg: params.cfgScale || 7.5,
          sampler_name: params.sampler || 'euler',
          scheduler: params.scheduler || 'normal',
          denoise: 1.0,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['5', 0],
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: params.width || 512,
          height: params.height || 512,
          batch_size: params.batchSize || 1,
        },
      },
      '6': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['4', 0],
          vae: ['1', 2],
        },
      },
      '7': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'LoFi_AI_Studio',
          images: ['6', 0],
        },
      },
    };

    const outputs = await this.executeWorkflow(workflow);
    return {
      images: outputs.images,
      seeds: [seed],
    };
  }

  async imageToImage(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    referenceImage: string,
    params: ImageGenerationParams
  ): Promise<{ images: string[]; seeds: number[] }> {
    const seed = params.seed ?? Math.floor(Math.random() * 2147483647);
    const uploadedFilename = await this.uploadImageToComfyUI(referenceImage);
    const workflow: ComfyUIWorkflow = {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: modelId,
        },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['1', 1],
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: negativePrompt || '',
          clip: ['1', 1],
        },
      },
      '4': {
        class_type: 'LoadImage',
        inputs: {
          image: uploadedFilename,
        },
      },
      '5': {
        class_type: 'VAEEncode',
        inputs: {
          pixels: ['4', 0],
          vae: ['1', 2],
        },
      },
      '6': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: params.steps || 20,
          cfg: params.cfgScale || 7.5,
          sampler_name: params.sampler || 'euler',
          scheduler: params.scheduler || 'normal',
          denoise: 0.7,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['5', 0],
        },
      },
      '7': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['6', 0],
          vae: ['1', 2],
        },
      },
      '8': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'LoFi_AI_Studio_i2i',
          images: ['7', 0],
        },
      },
    };

    const outputs = await this.executeWorkflow(workflow);
    return {
      images: outputs.images,
      seeds: [seed],
    };
  }

  async textToVideo(
    modelId: string,
    prompt: string,
    params: VideoGenerationParams
  ): Promise<{ videoFile: string; duration: number; frames: number }> {
    const videoParams = params as ComfyVideoParams;
    const videoModel = await this.getVideoModel(modelId);
    const seed = videoParams.seed ?? Math.floor(Math.random() * 2147483647);
    const frames = videoParams.frames || 81;
    const fps = videoParams.fps || videoModel.defaultFps || 20;

    const workflow: ComfyUIWorkflow = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: videoParams.steps || 15,
          cfg: videoParams.cfgScale || 5,
          sampler_name: videoParams.sampler || 'uni_pc',
          scheduler: videoParams.scheduler || 'simple',
          denoise: 1,
          model: ['48', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['55', 0],
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['38', 0],
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text:
            'oversaturated, overexposed, static frame, blurry details, subtitles, style transfer, painting, illustration, frozen image, dull scene, worst quality, low quality, jpeg artifacts, ugly, deformed, extra fingers, bad hands, bad face, malformed limbs, fused fingers, chaotic background, duplicate people, walking backward',
          clip: ['38', 0],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['39', 0],
        },
      },
      '37': {
        class_type: 'UNETLoader',
        inputs: {
          unet_name: modelId,
          weight_dtype: 'default',
        },
      },
      '38': {
        class_type: 'CLIPLoader',
        inputs: {
          clip_name: String(videoModel.metadata?.clipName || ''),
          type: 'wan',
          device: 'default',
        },
      },
      '39': {
        class_type: 'VAELoader',
        inputs: {
          vae_name: String(videoModel.metadata?.vaeName || ''),
        },
      },
      '48': {
        class_type: 'ModelSamplingSD3',
        inputs: {
          shift: 8,
          model: ['37', 0],
        },
      },
      '55': {
        class_type: 'Wan22ImageToVideoLatent',
        inputs: {
          width: videoParams.width || 768,
          height: videoParams.height || 512,
          length: frames,
          batch_size: 1,
          vae: ['39', 0],
        },
      },
      '57': {
        class_type: 'CreateVideo',
        inputs: {
          fps,
          images: ['8', 0],
        },
      },
      '58': {
        class_type: 'SaveVideo',
        inputs: {
          filename_prefix: 'video/LoFi_AI_Studio',
          format: 'auto',
          codec: 'auto',
          'video-preview': '',
          video: ['57', 0],
        },
      },
    };

    const outputs = await this.executeWorkflow(workflow, 900);
    if (outputs.videos.length === 0) {
      throw new Error('ComfyUI did not return a video file');
    }

    return {
      videoFile: outputs.videos[0],
      duration: frames / fps,
      frames,
    };
  }

  async imageToVideo(
    _modelId: string,
    _prompt: string,
    _referenceImage: string,
    _params: VideoGenerationParams
  ): Promise<{ videoFile: string; duration: number; frames: number }> {
    throw new Error(
      'Image-to-video is not wired yet for the current Wan workflow. Add a validated ComfyUI reference-image graph to enable it.'
    );
  }

  async textTo3D(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    params: Model3DGenerationParams
  ): Promise<{ modelFiles: string[]; seeds: number[] }> {
    const model3D = await this.getModel3D(modelId);
    const seed = params.seed ?? Math.floor(Math.random() * 2147483647);
    const format = params.format || model3D.defaultFormat || 'glb';

    // Generic 3D generation workflow using Trellis/Hunyuan3D-style custom nodes.
    // This workflow uses the common pattern: UNETLoader → KSampler → 3D decode → Save.
    // The exact node names may vary by custom node pack; this provides a reasonable default.
    const workflow: ComfyUIWorkflow = {
      '1': {
        class_type: 'UNETLoader',
        inputs: {
          unet_name: modelId,
          weight_dtype: 'default',
        },
      },
      '2': {
        class_type: 'CLIPLoader',
        inputs: {
          clip_name: String(model3D.metadata?.clipName || ''),
          type: 'sd3',
          device: 'default',
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['2', 0],
        },
      },
      '4': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: negativePrompt || 'low quality, blurry, distorted, incomplete',
          clip: ['2', 0],
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: 512,
          height: 512,
          batch_size: params.batchSize || 1,
        },
      },
      '6': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: params.steps || 25,
          cfg: params.cfgScale || 7.5,
          sampler_name: 'dpmpp_2m',
          scheduler: 'karras',
          denoise: params.denoisingStrength ?? 1.0,
          model: ['1', 0],
          positive: ['3', 0],
          negative: ['4', 0],
          latent_image: ['5', 0],
        },
      },
      '7': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['6', 0],
          vae: ['8', 0],
        },
      },
      '8': {
        class_type: 'VAELoader',
        inputs: {
          vae_name: String(model3D.metadata?.vaeName || ''),
        },
      },
      '9': {
        class_type: 'Save3DModel',
        inputs: {
          filename_prefix: '3d/LoFi_AI_Studio',
          format,
          mesh: ['7', 0],
          texture_resolution: params.textureResolution || 1024,
        },
      },
    };

    const outputs = await this.executeWorkflow(workflow, 600);
    if (outputs.models.length === 0) {
      throw new Error('ComfyUI did not return a 3D model file');
    }

    return {
      modelFiles: outputs.models,
      seeds: [seed],
    };
  }

  async imageTo3D(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    referenceImage: string,
    params: Model3DGenerationParams
  ): Promise<{ modelFiles: string[]; seeds: number[] }> {
    const model3D = await this.getModel3D(modelId);
    const seed = params.seed ?? Math.floor(Math.random() * 2147483647);
    const format = params.format || model3D.defaultFormat || 'glb';
    const uploadedFilename = await this.uploadImageToComfyUI(referenceImage);

    const workflow: ComfyUIWorkflow = {
      '1': {
        class_type: 'UNETLoader',
        inputs: {
          unet_name: modelId,
          weight_dtype: 'default',
        },
      },
      '2': {
        class_type: 'CLIPLoader',
        inputs: {
          clip_name: String(model3D.metadata?.clipName || ''),
          type: 'sd3',
          device: 'default',
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['2', 0],
        },
      },
      '4': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: negativePrompt || 'low quality, blurry, distorted, incomplete',
          clip: ['2', 0],
        },
      },
      '5': {
        class_type: 'LoadImage',
        inputs: {
          image: uploadedFilename,
        },
      },
      '6': {
        class_type: 'VAEEncode',
        inputs: {
          pixels: ['5', 0],
          vae: ['8', 0],
        },
      },
      '7': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: params.steps || 25,
          cfg: params.cfgScale || 7.5,
          sampler_name: 'dpmpp_2m',
          scheduler: 'karras',
          denoise: params.denoisingStrength ?? 1.0,
          model: ['1', 0],
          positive: ['3', 0],
          negative: ['4', 0],
          latent_image: ['6', 0],
        },
      },
      '8': {
        class_type: 'VAELoader',
        inputs: {
          vae_name: String(model3D.metadata?.vaeName || ''),
        },
      },
      '9': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['7', 0],
          vae: ['8', 0],
        },
      },
      '10': {
        class_type: 'Save3DModel',
        inputs: {
          filename_prefix: '3d/LoFi_AI_Studio_i23d',
          format,
          mesh: ['9', 0],
          texture_resolution: params.textureResolution || 1024,
        },
      },
    };

    const outputs = await this.executeWorkflow(workflow, 600);
    if (outputs.models.length === 0) {
      throw new Error('ComfyUI did not return a 3D model file');
    }

    return {
      modelFiles: outputs.models,
      seeds: [seed],
    };
  }

  private async getModel3D(modelId: string): Promise<Model3DModel> {
    const model = (await this.getModels()).find(
      (entry): entry is Model3DModel => entry.modality === '3d' && entry.id === modelId
    );

    if (!model) {
      throw new Error(`3D model not found in ComfyUI: ${modelId}`);
    }

    return model;
  }

  private async getVideoModel(modelId: string): Promise<VideoModel> {
    const model = (await this.getModels()).find(
      (entry): entry is VideoModel => entry.modality === 'video' && entry.id === modelId
    );

    if (!model) {
      throw new Error(`Video model not found in ComfyUI: ${modelId}`);
    }

    if (!model.metadata?.clipName || !model.metadata?.vaeName) {
      throw new Error(
        `Video model ${modelId} is missing Wan dependencies. Make sure the UMT5 CLIP and Wan VAE are installed in ComfyUI.`
      );
    }

    return model;
  }

  private async fetchObjectInfo<T>(nodeName: string): Promise<T> {
    const response = await fetch(`${this._endpoint}/object_info/${nodeName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ComfyUI object info for ${nodeName}: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async executeWorkflow(
    workflow: ComfyUIWorkflow,
    maxAttempts: number = 300
  ): Promise<WorkflowOutputs> {
    const response = await fetch(`${this._endpoint}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
        client_id: this._clientId,
      } satisfies ComfyUIPromptRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const { prompt_id } = (await response.json()) as { prompt_id: string };
    return this.waitForCompletion(prompt_id, maxAttempts);
  }

  private async uploadImageToComfyUI(imageData: string): Promise<string> {
    const filename = `input_${uuidv4()}.png`;
    let imageBuffer: Buffer;

    if (imageData.startsWith('data:')) {
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageData.startsWith('http')) {
      const response = await fetch(imageData);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      return imageData;
    }

    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer]), filename);
    formData.append('overwrite', 'true');

    const uploadResponse = await fetch(`${this._endpoint}/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image to ComfyUI: HTTP ${uploadResponse.status}`);
    }

    const result = (await uploadResponse.json()) as {
      name: string;
      subfolder?: string;
      type?: string;
    };
    return result.name;
  }

  private async waitForCompletion(
    promptId: string,
    maxAttempts: number
  ): Promise<WorkflowOutputs> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this._endpoint}/history/${promptId}`);
        if (response.ok) {
          const history = (await response.json()) as ComfyUIHistoryResponse;
          const promptHistory = history[promptId];

          if (promptHistory?.outputs) {
            const images: string[] = [];
            const videos: string[] = [];
            const models: string[] = [];

            for (const output of Object.values(promptHistory.outputs)) {
              if (output.images) {
                images.push(...output.images.map((asset) => this.buildAssetUrl(asset)));
              }

              const videoAssets = [...(output.videos || []), ...(output.gifs || [])];
              if (videoAssets.length > 0) {
                videos.push(...videoAssets.map((asset) => this.buildAssetUrl(asset)));
              }

              // 3D model outputs — meshes and glbs
              const modelAssets = [...(output.meshes || []), ...(output.glbs || [])];
              if (modelAssets.length > 0) {
                models.push(...modelAssets.map((asset) => this.buildAssetUrl(asset)));
              }
            }

            if (images.length > 0 || videos.length > 0 || models.length > 0) {
              return { images, videos, models };
            }
          }
        }
      } catch (error) {
        console.error('Error checking ComfyUI history:', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts += 1;
    }

    throw new Error('ComfyUI job timed out');
  }

  private buildAssetUrl(asset: ComfyUIAsset): string {
    return `${this._endpoint}/view?filename=${encodeURIComponent(asset.filename)}&subfolder=${encodeURIComponent(asset.subfolder)}&type=${asset.type}`;
  }
}
