/**
 * Workflow format converters: ComfyUI and n8n → native Workflow
 */
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from './types/index.js';

// ─── ComfyUI types ───────────────────────────────────────────────────────────

interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
    x?: number;
    y?: number;
  };
}

type ComfyWorkflow = Record<string, ComfyNode>;

// ─── n8n types ──────────────────────────────────────────────────────────────

interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters?: Record<string, unknown>;
}

interface N8nConnectionEntry {
  node: string;
  type: 'main';
  index: number;
}

interface N8nWorkflow {
  nodes: N8nNode[];
  connections?: Record<string, Record<string, N8nConnectionEntry[]>>;
}

// ─── ComfyUI class_type → WorkflowNodeType mapping ──────────────────────────

const COMFYUI_TYPE_MAP: Record<string, WorkflowNodeType> = {
  // Trigger / input
  'NeoG_Simple_Webcam_Easy':       'trigger.manual',
  'WD14Tagger|pysssss':            'skill',

  // Text models
  'CLIPTextEncode':                 'skill',
  'CLIPTextEncodeSD3':              'skill',
  'CLIPTextEncodeFlux':             'skill',

  // Image generation / model.image
  'KSampler':                       'model.image',
  'KSamplerAdvanced':               'model.image',
  'SamplerCustom':                  'model.image',
  'SamplerCustomAdvanced':          'model.image',
  'Efficient Sampler':              'model.image',
  'FluxGuidance':                   'model.image',
  'BasicScheduler':                 'model.image',
  'SDTurboScheduler':               'model.image',

  // Checkpoint / model loading
  'CheckpointLoaderSimple':         'skill',
  'UNETLoader':                     'skill',
  'DualCLIPLoader':                 'skill',
  'VAELoader':                      'skill',
  'CLIPVisionLoader':               'skill',
  'ControlNetLoader':               'skill',
  'LoraLoader':                     'skill',
  'LoraLoaderModelOnly':            'skill',

  // Image processing
  'EmptyLatentImage':               'output.note',
  'EmptySD3LatentImage':            'output.note',
  'VAEDecode':                      'model.image',
  'VAEEncode':                      'model.image',
  'VAEEncodeForInpaint':            'model.image',
  'VHS_VideoCombine':               'model.video',
  'VHS_VideoCombineCrafter':        'model.video',

  // Preview / output
  'SaveImage':                      'output.note',
  'PreviewImage':                   'output.note',

  // Audio
  'SaveAudio':                      'model.audio.tts',
  'VHS_Audio':                      'model.audio.tts',

  // Upscaling / refinement
  'UpscaleImage':                   'skill',
  'ImageUpscaleWithModel':          'skill',
  'ImageScale':                     'skill',
  'ImageScaleToTotalPixels':        'skill',

  // Mask / compositing
  'MaskComposite':                  'skill',
  'Composite':                      'skill',
  'ImageCompositeMasked':           'skill',
  'GrowMask':                       'skill',

  // Conditioning
  'CLIPVisionEncode':               'skill',
  'unCLIPConditioning':             'skill',
  'ConditioningCombine':            'skill',
  'ConditioningAverage':            'skill',
  'ConditioningSetTimestepRange':   'skill',
};

// ─── n8n type → WorkflowNodeType mapping ────────────────────────────────────

const N8N_TYPE_MAP: Record<string, WorkflowNodeType> = {
  'n8n-nodes-base.webhook':           'trigger.manual',
  'n8n-nodes-base.scheduleTrigger':   'trigger.schedule',
  'n8n-nodes-base.httpRequest':       'skill',
  'n8n-nodes-base.set':              'skill',
  'n8n-nodes-base.if':               'skill',
  'n8n-nodes-base.switch':           'skill',
  'n8n-nodes-base.code':             'skill',
  'n8n-nodes-base.function':         'skill',
  'n8n-nodes-base.openAi':           'model.text',
  'n8n-nodes-base.stabilityAi':      'model.image',
  'n8n-nodes-base.wait':             'skill',
  'n8n-nodes-base.splitInBatches':   'skill',
  'n8n-nodes-base.merge':            'skill',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  // Browser-safe UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function snapToGrid(val: number, grid: number = 20): number {
  return Math.round(val / grid) * grid;
}

// ─── Auto-layout ─────────────────────────────────────────────────────────────

function autoLayout(
  nodes: { id: string; type: WorkflowNodeType }[],
  edges: { from: string; to: string }[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Build adjacency
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }
  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    children.get(e.from)?.push(e.to);
  }

  // Topological sort for layers
  const layers: string[][] = [];
  const remaining = new Set(nodes.map((n) => n.id));
  while (remaining.size > 0) {
    const layer = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    if (layer.length === 0) {
      // Cycle detected - break by picking first remaining
      layer.push([...remaining][0]);
    }
    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
      for (const child of children.get(id) ?? []) {
        inDegree.set(child, (inDegree.get(child) ?? 1) - 1);
      }
    }
  }

  // Assign positions
  const X_SPACING = 260;
  const Y_SPACING = 140;
  const START_X = 80;
  const START_Y = 80;

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const totalHeight = (layer.length - 1) * Y_SPACING;
    for (let ni = 0; ni < layer.length; ni++) {
      const x = snapToGrid(START_X + li * X_SPACING);
      const y = snapToGrid(START_Y + ni * Y_SPACING - totalHeight / 2);
      positions.set(layer[ni], { x, y });
    }
  }

  return positions;
}

// ─── ComfyUI converter ───────────────────────────────────────────────────────

export function convertComfyUI(
  data: Record<string, unknown>,
  name: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  // Validate format
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  const comfyNodes: ComfyWorkflow = {};
  for (const k of keys) {
    const val = data[k];
    if (val && typeof val === 'object' && 'class_type' in (val as object)) {
      comfyNodes[k] = val as ComfyNode;
    } else {
      return null;
    }
  }

  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const nodeIdMap = new Map<string, string>(); // ComfyUI key → UUID

  // First pass: create nodes
  for (const [ckey, cnode] of Object.entries(comfyNodes)) {
    const uid = generateId();
    nodeIdMap.set(ckey, uid);

    const mappedType = COMFYUI_TYPE_MAP[cnode.class_type] ?? 'skill';
    const label = cnode._meta?.title ?? cnode.class_type;

    nodes.push({
      id: uid,
      type: mappedType,
      label,
      x: 0,
      y: 0,
      config: {
        originalClassType: cnode.class_type,
        originalInputs: cnode.inputs,
      },
    });
  }

  // Second pass: extract edges from inputs
  for (const [ckey, cnode] of Object.entries(comfyNodes)) {
    const fromUid = nodeIdMap.get(ckey);
    if (!fromUid) continue;

    for (const [inputName, inputVal] of Object.entries(cnode.inputs)) {
      // ComfyUI edges are arrays like ["4", 0] meaning node "4", output index 0
      if (Array.isArray(inputVal) && inputVal.length >= 2 && typeof inputVal[0] === 'string') {
        const targetCkey = inputVal[0];
        const toUid = nodeIdMap.get(targetCkey);
        if (toUid && fromUid !== toUid) {
          // Check if this edge already exists
          const exists = edges.some(
            (e) => e.from === toUid && e.to === fromUid,
          );
          if (!exists) {
            edges.push({
              id: generateId(),
              from: toUid,
              to: fromUid,
            });
          }
        }
      }
    }
  }

  // Auto-layout
  const positions = autoLayout(
    nodes.map((n) => ({ id: n.id, type: n.type })),
    edges,
  );
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) {
      node.x = pos.x;
      node.y = pos.y;
    }
  }

  return { nodes, edges };
}

// ─── n8n converter ───────────────────────────────────────────────────────────

export function convertN8N(
  data: Record<string, unknown>,
  name: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  if (!data.nodes || !Array.isArray(data.nodes)) return null;

  const n8nWorkflow = data as unknown as N8nWorkflow;
  if (n8nWorkflow.nodes.length === 0) return null;

  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  // Track node name → UUID mapping
  const nodeIdMap = new Map<string, string>();

  // Create nodes
  for (const n8nNode of n8nWorkflow.nodes) {
    const uid = n8nNode.id || generateId();
    nodeIdMap.set(n8nNode.name, uid);

    const mappedType = N8N_TYPE_MAP[n8nNode.type] ?? 'skill';
    const [rawX, rawY] = n8nNode.position ?? [0, 0];
    const position: { x: number; y: number } = n8nNode.position
      ? { x: snapToGrid(rawX), y: snapToGrid(rawY) }
      : { x: 0, y: 0 };

    nodes.push({
      id: uid,
      type: mappedType,
      label: n8nNode.name,
      x: position.x,
      y: position.y,
      config: {
        originalNodeType: n8nNode.type,
        originalTypeVersion: n8nNode.typeVersion,
        originalParameters: n8nNode.parameters ?? {},
      },
    });
  }

  // Create edges from connections
  if (n8nWorkflow.connections) {
    for (const [sourceName, sourceConns] of Object.entries(n8nWorkflow.connections)) {
      const fromUid = nodeIdMap.get(sourceName);
      if (!fromUid) continue;

      // n8n connections: { outputType: [ [ { node, type, index } ] ] }
      for (const outputGroup of Object.values(sourceConns)) {
        if (!Array.isArray(outputGroup)) continue;
        for (const connList of outputGroup) {
          if (!Array.isArray(connList)) continue;
          for (const conn of connList) {
            if (conn && typeof conn === 'object' && 'node' in conn) {
              const entry = conn as N8nConnectionEntry;
              const toUid = nodeIdMap.get(entry.node);
              if (toUid) {
                const exists = edges.some(
                  (e) => e.from === fromUid && e.to === toUid,
                );
                if (!exists) {
                  edges.push({
                    id: generateId(),
                    from: fromUid,
                    to: toUid,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // Auto-layout if no positions were provided
  const hasPositions = nodes.some((n) => n.x !== 0 || n.y !== 0);
  if (!hasPositions) {
    const positions = autoLayout(
      nodes.map((n) => ({ id: n.id, type: n.type })),
      edges,
    );
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
    }
  }

  return { nodes, edges };
}
