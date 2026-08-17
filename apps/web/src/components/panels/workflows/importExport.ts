import type { Workflow as WorkflowType } from '@lofiaistudio/shared';

export type ExternalFormat = 'comfyui' | 'n8n' | 'generic';

export function detectFormat(data: unknown): ExternalFormat {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'generic';
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
    const sample = obj[keys[0]];
    if (sample && typeof sample === 'object' && 'class_type' in (sample as object)) return 'comfyui';
  }
  if ('nodes' in obj && Array.isArray(obj.nodes) && 'connections' in obj) return 'n8n';
  return 'generic';
}

export function isOrchestrationWorkflow(data: unknown): data is Partial<WorkflowType> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  return 'name' in obj && Array.isArray(obj.nodes) && Array.isArray(obj.edges);
}

export function triggerDownload(filename: string, content: unknown) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const EXT_FORMAT_LABEL: Record<ExternalFormat, string> = { comfyui: 'ComfyUI', n8n: 'n8n', generic: 'JSON' };
export const DEFAULT_WORKFLOW_CATEGORY = 'General';

export function workflowCategory(workflow: Partial<WorkflowType>): string {
  return workflow.category?.trim() || DEFAULT_WORKFLOW_CATEGORY;
}

export function comfySkillName(classType: string): string {
  return `comfyui.${classType}`;
}

export function comfySkillId(classType: string): string {
  return `skill-comfyui-${classType.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node'}`;
}

export function extractComfyClassTypes(data: Record<string, unknown>): string[] {
  const types = new Set<string>();
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && 'class_type' in value) {
      const classType = String((value as { class_type?: unknown }).class_type ?? '').trim();
      if (classType) types.add(classType);
    }
  }
  return Array.from(types);
}

export function createFluxImageWorkflow(): Partial<WorkflowType> {
  const triggerId = generateId();
  const imageId = generateId();
  const outputId = generateId();
  return {
    name: 'Flux Image Creation',
    description: 'Generate Flux-style images with editable prompt and image parameters.',
    project: 'Image',
    category: 'Image',
    enabled: true,
    nodes: [
      { id: triggerId, type: 'trigger.manual', label: 'Manual trigger', x: 80, y: 120, config: {} },
      {
        id: imageId,
        type: 'model.image',
        label: 'Flux image',
        x: 360,
        y: 120,
        config: {
          prompt: 'A cinematic Flux image, crisp detail, natural lighting',
          negativePrompt: '',
          width: 512,
          height: 512,
          steps: 20,
          cfgScale: 7.5,
          sampler: 'euler',
          scheduler: 'normal',
        },
      },
      { id: outputId, type: 'output.note', label: 'Image result', x: 640, y: 120, config: { note: 'Flux image generation completed.' } },
    ],
    edges: [
      { id: generateId(), from: triggerId, to: imageId },
      { id: generateId(), from: imageId, to: outputId },
    ],
  };
}
