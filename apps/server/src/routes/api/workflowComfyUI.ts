import { Router, Request, Response } from 'express';
import type { Workflow } from '@lofiaistudio/shared';

export interface ParameterManifestEntry {
  nodeId: string;
  nodeType: string;
  inputName: string;
  inputType: 'number' | 'string' | 'boolean' | 'select' | 'image';
  min?: number;
  max?: number;
  step?: number;
  default?: unknown;
  options?: string[];
}

export function createWorkflowComfyUIRouter(): Router {
  const router = Router();

  // GET /api/workflows/:id/comfyui - returns the ComfyUI-native JSON + parameter manifest
  router.get('/:id/comfyui', async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id;
      
      // Load from DB via adapterRegistry would go here
      // For now, return a structured manifest derived from the workflow definition
      let workflow: Workflow | undefined = (req as unknown as { locals: { workflow?: Workflow } }).locals?.workflow;
      
      if (!workflow) {
        // Try to get from orchestration store via API
        const workflowResponse = await fetch(`/api/workflows/${workflowId}`);
        const workflowData = await workflowResponse.json() as { data?: Workflow };
        workflow = workflowData.data;
      }

      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }

      // Build a ComfyUI-style workflow from the stored graph
      const comfyWorkflow: Record<string, unknown> = {};
      const parameterManifest: ParameterManifestEntry[] = [];

      // Map common node types to their tunable inputs
      const nodeInputMap: Record<string, string[]> = {
        'KSampler': ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
        'KSamplerAdvanced': ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
        'EmptyLatentImage': ['width', 'height', 'batch_size'],
        'EmptySD3LatentImage': ['width', 'height', 'batch_size'],
        'CLIPTextEncode': ['text'],
        'CLIPTextEncodeSDXL': ['text', 'text_l', 'text_g'],
        'LoraLoader': ['lora_name', 'strength'],
        'VAELoader': ['vae_name'],
        'CheckpointLoaderSimple': ['ckpt_name'],
        'UNETLoader': ['unet_name'],
        'ControlNetApply': ['strength'],
        'ControlNetLoader': ['control_net'],
        'UpscaleModelLoader': ['model_name'],
        'ImageScaleBy': ['upscale_method', 'width', 'height', 'crop'],
      };

      for (const node of workflow.nodes) {
        const nodeType = node.type.replace('model.', '').replace('logic.', '').replace('output.', '').replace('trigger.', '');
        const tunableInputs = nodeInputMap[nodeType] || [];
        
        for (const inputName of tunableInputs) {
          const value = node.config?.[inputName];
          let inputType: ParameterManifestEntry['inputType'] = 'string';
          if (['seed', 'steps', 'cfg', 'width', 'height', 'batch_size', 'strength'].includes(inputName)) {
            inputType = 'number';
          } else if (inputName === 'denoise') {
            inputType = 'number';
            parameterManifest.push({
              nodeId: node.id,
              nodeType,
              inputName,
              inputType,
              min: 0,
              max: 1,
              step: 0.05,
              default: value ?? 0.75,
            });
            continue;
          } else if (['sampler_name', 'scheduler'].includes(inputName)) {
            inputType = 'select';
            const options: string[] = inputName === 'sampler_name' 
              ? ['euler', 'euler_a', 'dpmpp_2m', 'dpmpp_2m_sde', 'ddim']
              : ['normal', 'karras', 'exponential'];
            parameterManifest.push({
              nodeId: node.id,
              nodeType,
              inputName,
              inputType,
              default: value ?? options[0],
              options,
            });
            continue;
          } else if (inputName === 'text') {
            inputType = 'string';
          } else if (inputName === 'crop') {
            inputType = 'boolean';
          }

          parameterManifest.push({
            nodeId: node.id,
            nodeType,
            inputName,
            inputType,
            default: value,
          });
        }

        // Add node to ComfyUI workflow with its config as inputs
        comfyWorkflow[node.id] = {
          class_type: nodeType,
          inputs: Object.entries(node.config || {}).map(([name, val]) => ({
            name,
            value: val,
          })),
        };
      }

      return res.json({
        success: true,
        data: {
          workflowId: workflow.id,
          name: workflow.name,
          description: workflow.description,
          comfyWorkflow,
          parameterManifest,
          lastUsed: workflow.updatedAt,
        },
      });
    } catch (error) {
      console.error('Failed to build ComfyUI workflow manifest:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build workflow manifest',
      });
    }
  });

  return router;
}