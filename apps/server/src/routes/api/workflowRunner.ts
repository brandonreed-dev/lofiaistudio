import type { ActivityEvent, AppSettings, Model, RuntimeType, Skill, Workflow, WorkflowEdge, WorkflowNode, WorkflowResult, WorkflowRun } from '@lofiaistudio/shared';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AdapterRegistry } from '../../adapters/index.js';
import type { AudioAdapter, ImageAdapter, TextAdapter, VideoAdapter } from '../../adapters/base.js';
import type { CloudAdapter, CloudAdapterRegistry } from '../../adapters/cloud/index.js';
import { dbOperations } from '../../db/index.js';
import { executeHttpSkillRequest } from '../../httpSkillExecutor.js';
import { estimateWorkflowCost } from '../../costEstimates.js';

type WorkflowRunnerHelpers = {
  now: () => string;
  addActivity: (
    event: Omit<ActivityEvent, 'id' | 'createdAt'> & Partial<Pick<ActivityEvent, 'id' | 'createdAt'>>
  ) => ActivityEvent;
};

export function createWorkflowServices(
  adapterRegistry: AdapterRegistry,
  helpers: WorkflowRunnerHelpers,
  cloudAdapterRegistry: CloudAdapterRegistry
) {
  const { now, addActivity } = helpers;

  function buildContextMap(
    nodeId: string,
    workflow: Workflow,
    output: Record<string, unknown>,
    input?: Record<string, unknown>
  ): Record<string, unknown> {
    const ctx: Record<string, unknown> = { ...input };
    // Find all incoming edges to this node
    const incomingEdges = workflow.edges.filter((e) => e.to === nodeId);
    for (const edge of incomingEdges) {
      const upstreamOutput = output[edge.from];
      if (upstreamOutput) {
        ctx[edge.from] = upstreamOutput;
        // Also flatten top-level keys into context for easy access
        if (typeof upstreamOutput === 'object' && upstreamOutput !== null) {
          for (const [k, v] of Object.entries(upstreamOutput as Record<string, unknown>)) {
            if (!(k in ctx)) {
              ctx[k] = v;
            }
          }
        }
      }
    }
    return ctx;
  }

  // Topological sort: returns node IDs in execution order based on edges
  function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    const allIds = new Set(nodes.map((n) => n.id));

    for (const id of allIds) {
      inDegree[id] = 0;
      adj[id] = [];
    }
    for (const edge of edges) {
      if (allIds.has(edge.from) && allIds.has(edge.to)) {
        adj[edge.from].push(edge.to);
        inDegree[edge.to] = (inDegree[edge.to] ?? 0) + 1;
      }
    }

    const queue: string[] = [];
    for (const id of allIds) {
      if (inDegree[id] === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(id);
      for (const neighbor of adj[id]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      }
    }

    // Append any nodes not reached (no edges) at the end
    for (const id of allIds) {
      if (!sorted.includes(id)) sorted.push(id);
    }

    return sorted;
  }

  const runWorkflow = async (
    workflow: Workflow,
    trigger: WorkflowRun['trigger'],
    input?: Record<string, unknown>
  ): Promise<WorkflowRun> => {
    const run: WorkflowRun = {
      id: uuidv4(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      trigger,
      startedAt: now(),
      input,
      output: {},
    };
    dbOperations.addToCollection('workflowRuns', run);
    addActivity({
      type: 'workflow.run.started',
      title: 'Workflow started',
      message: `${workflow.name} started from ${trigger}.`,
      tone: 'cyan',
      entityType: 'workflow',
      entityId: workflow.id,
    });

    try {
      const output: Record<string, unknown> = {};
      const toasts: string[] = [];
      const executionOrder = topologicalSort(workflow.nodes, workflow.edges);
      const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));

      for (const nodeId of executionOrder) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        const ctx = buildContextMap(nodeId, workflow, output, input);
        const runInput = { ...input, ...ctx };

        if (node.type === 'model.text') {
          const cloudProvider = node.config.cloudProvider as string | undefined;
          const cloudModel = node.config.cloudModel as string | undefined;
          if (cloudProvider && cloudModel) {
            const cloudAdapter = cloudAdapterRegistry.get(cloudProvider as any);
            if (cloudAdapter) {
              const prompt = String(node.config.prompt ?? runInput?.prompt ?? workflow.description);
              try {
                const text = await cloudAdapter.complete(cloudModel, prompt, {
                  temperature: Number(node.config.temperature ?? 0.7),
                  maxTokens: Number(node.config.maxTokens ?? 512),
                });
                output[node.id] = { text, provider: cloudProvider };
              } catch (error) {
                output[node.id] = { error: error instanceof Error ? error.message : String(error), provider: cloudProvider };
              }
            } else {
              output[node.id] = { skipped: true, reason: `Cloud provider not configured: ${cloudProvider}` };
            }
          } else {
            const adapter = adapterRegistry.get<TextAdapter>('ollama');
            const models = adapter ? await adapter.getModels() : [];
            const modelId = String(node.config.modelId ?? models[0]?.id ?? '');
            if (!adapter || !adapter.isConnected() || !modelId) {
              output[node.id] = { skipped: true, reason: 'Ollama unavailable or no text model selected' };
              continue;
            }
            const prompt = String(node.config.prompt ?? runInput?.prompt ?? workflow.description);
            const text = await adapter.complete(modelId, prompt, {
              temperature: Number(node.config.temperature ?? 0.7),
              maxTokens: Number(node.config.maxTokens ?? 512),
            });
            output[node.id] = { text };
          }
        } else if (node.type === 'model.image') {
          const cloudProvider = node.config.cloudProvider as string | undefined;
          const cloudModel = node.config.cloudModel as string | undefined;
          if (cloudProvider && cloudModel) {
            const cloudAdapter = cloudAdapterRegistry.get(cloudProvider as any);
            if (cloudAdapter && cloudAdapter.textToImage) {
              const prompt = String(node.config.prompt ?? runInput?.prompt ?? workflow.description);
              try {
                const result = await cloudAdapter.textToImage(cloudModel, prompt, null, {
                  steps: Number(node.config.steps ?? 20),
                  cfgScale: Number(node.config.cfgScale ?? 7.5),
                  width: Number(node.config.width ?? 1024),
                  height: Number(node.config.height ?? 1024),
                  batchSize: 1,
                });
                output[node.id] = { ...result, provider: cloudProvider };
              } catch (error) {
                output[node.id] = { error: error instanceof Error ? error.message : String(error), provider: cloudProvider };
              }
            } else {
              output[node.id] = { skipped: true, reason: `Cloud provider ${cloudProvider} does not support image generation` };
            }
          } else {
            const adapter = adapterRegistry.get<ImageAdapter>('comfyui');
            const models = adapter ? await adapter.getModels() : [];
            const modelId = String(node.config.modelId ?? models.find((model) => model.modality === 'image')?.id ?? '');
            if (!adapter || !adapter.isConnected() || !modelId) {
              output[node.id] = { skipped: true, reason: 'ComfyUI unavailable or no image model selected' };
              continue;
            }
            const prompt = String(node.config.prompt ?? runInput?.prompt ?? workflow.description);
            output[node.id] = await adapter.textToImage(modelId, prompt, null, {
              steps: Number(node.config.steps ?? 20),
              cfgScale: Number(node.config.cfgScale ?? 7.5),
              width: Number(node.config.width ?? 512),
              height: Number(node.config.height ?? 512),
              batchSize: 1,
            });
          }
        } else if (node.type === 'model.video') {
          const match = await getVideoModel(String(node.config.modelId ?? ''));
          if (!match || !match.adapter.isConnected()) {
            output[node.id] = { skipped: true, reason: 'Video model unavailable' };
            continue;
          }
          const prompt = String(node.config.prompt ?? runInput?.prompt ?? workflow.description);
          output[node.id] = await match.adapter.textToVideo(match.model.id, prompt, {
            frames: Number(node.config.frames ?? 16),
            fps: Number(node.config.fps ?? 20),
            steps: Number(node.config.steps ?? 15),
            cfgScale: Number(node.config.cfgScale ?? 5),
            width: Number(node.config.width ?? 768),
            height: Number(node.config.height ?? 512),
          });
        } else if (node.type === 'model.audio.tts') {
          const models: Model[] = [];
          for (const adapter of adapterRegistry.getAll()) {
            if (adapter.type === 'qwen3-tts') models.push(...(await adapter.getModels()));
          }
          const model = models.find((entry) => entry.modality === 'audio' && entry.type === 'tts');
          const match = model ? await getAudioModel(model.id, model.runtime) : undefined;
          if (!match || !match.adapter.isConnected()) {
            output[node.id] = { skipped: true, reason: 'Qwen3 TTS unavailable' };
            continue;
          }
          output[node.id] = await match.adapter.synthesize(
            match.model.id,
            String(node.config.text ?? runInput?.text ?? workflow.description),
            { outputFormat: 'wav', speed: 1 }
          );
        } else if (node.type === 'skill') {
          const skillId = String(node.config.skillId ?? '');
          const skill = dbOperations.getCollection<Skill>('skills').find((s) => s.id === skillId);
          if (!skill || !skill.enabled) {
            output[node.id] = { skipped: true, reason: skill ? 'Skill disabled' : `Skill not found: ${skillId}` };
            continue;
          }
          // Execute the skill based on its execution type
          if (skill.executionType === 'http' && skill.endpoint) {
            try {
              const { status, result } = await executeHttpSkillRequest(
                skill,
                (node.config.input ?? {}) as Record<string, unknown>,
                runInput
              );
              output[node.id] = { result, status };
            } catch (error) {
              output[node.id] = { error: error instanceof Error ? error.message : String(error) };
            }
          } else if (skill.executionType === 'workflow' && skill.workflowId) {
            const wf = dbOperations.getCollection<Workflow>('workflows').find((w) => w.id === skill.workflowId);
            if (wf) {
              // Run the nested workflow in the background, we don't await it
              runWorkflow(wf, 'task', { ...(node.config.input ?? {}), ...(runInput ?? {}) }).catch(() => {});
              output[node.id] = { triggered: skill.workflowId, note: 'Workflow triggered in background' };
            } else {
              output[node.id] = { skipped: true, reason: `Workflow not found: ${skill.workflowId}` };
            }
          } else {
            // 'internal' or default: just log the skill was called
            output[node.id] = { skillName: skill.name, note: 'Skill executed' };
          }
          // Track usage
          const newRuns7d = (skill.runs7d ?? 0) + 1;
          const newUsedBy = Math.max(skill.usedBy ?? 0, 1);
          dbOperations.updateInCollection<Skill>('skills', skill.id, { runs7d: newRuns7d, usedBy: newUsedBy } as Partial<Skill>);
        } else if (node.type === 'output.note') {
          output[node.id] = { note: node.config.note ?? workflow.description };
        } else if (node.type === 'output.toast') {
          // Render toast message template with context data
          let message = String(node.config.message ?? 'Workflow task completed.');
          // Replace {{nodeId.field}} or {{field}} placeholders with context values
          message = message.replace(/\{\{([^}]+)\}\}/g, (_match: string, path: string) => {
            const parts = path.trim().split('.');
            let value: unknown = ctx;
            for (const part of parts) {
              if (value && typeof value === 'object') {
                value = (value as Record<string, unknown>)[part];
              } else {
                return _match; // preserve original {{path}} syntax if unresolvable
              }
            }
            return value != null ? String(value) : _match; // preserve original {{path}} syntax if unresolvable
          });
          // toasts.push(node.id);
          output[node.id] = { toast: message };
        } else if (node.type === 'output.file') {
          // Save output to a file on disk
          const settings = dbOperations.getSetting<AppSettings>('app');
          const outputDir = settings?.outputDir ?? join(require('os').homedir(), '.lofiaistudio', 'outputs');
          const filename = String(node.config.filename ?? `workflow-${workflow.name}-${now()}.json`);
          const format = String(node.config.format ?? 'json');
          const data = node.config.dataSelector
            ? resolveDataSelector(String(node.config.dataSelector), ctx)
            : { runId: run.id, workflow: workflow.name, output, timestamp: now() };
          
          if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
          }
          const filePath = join(outputDir, filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
          let content: string;
          if (format === 'csv') {
            // Simple CSV flattening
            const rows = Array.isArray(data) ? data : [data];
            const headers = new Set<string>();
            for (const row of rows) {
              if (typeof row === 'object' && row !== null) {
                for (const key of Object.keys(row as Record<string, unknown>)) {
                  headers.add(key);
                }
              }
            }
            const headerArr = Array.from(headers);
            const csvLines = [headerArr.join(',')];
            for (const row of rows) {
              if (typeof row === 'object' && row !== null) {
                const vals = headerArr.map((h) => {
                  const v = (row as Record<string, unknown>)[h];
                  const s = v != null ? String(v) : '';
                  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
                });
                csvLines.push(vals.join(','));
              }
            }
            content = csvLines.join('\n');
          } else {
            content = JSON.stringify(data, null, 2);
          }
          writeFileSync(filePath, content, 'utf-8');
          output[node.id] = { filePath, format, filename, savedTo: filePath };
        } else if (node.type === 'output.database') {
          // Save results to the workflowResults collection
          const label = String(node.config.label ?? node.label);
          const data = node.config.dataSelector
            ? resolveDataSelector(String(node.config.dataSelector), ctx)
            : { runId: run.id, workflow: workflow.name, output, timestamp: now() };
          
          const result: WorkflowResult = {
            id: uuidv4(),
            workflowId: workflow.id,
            workflowName: workflow.name,
            runId: run.id,
            label,
            data: data as Record<string, unknown>,
            createdAt: now(),
          };
          dbOperations.addToCollection('workflowResults', result);
          output[node.id] = { saved: true, resultId: result.id, label };
        }
      }

      // Compute cost estimate if any cloud provider was used
      let totalEstimatedCost = 0;
      let costProvider = '';
      let costCurrency = '';
      for (const node of workflow.nodes) {
        const provider = node.config.cloudProvider as string | undefined;
        const cloudModel = node.config.cloudModel as string | undefined;
        if (provider && cloudModel) {
          const nodeOutput = output[node.id];
          const estimate = estimateWorkflowCost(
            provider as any,
            cloudModel,
            node.type,
            nodeOutput && typeof nodeOutput === 'object' ? (nodeOutput as Record<string, unknown>) : undefined
          );
          if (estimate) {
            totalEstimatedCost += estimate.estimatedCost;
            costProvider = estimate.provider;
            costCurrency = estimate.currency;
          }
        }
      }
      const costEstimate =
        totalEstimatedCost > 0
          ? { provider: costProvider, estimatedCost: totalEstimatedCost, currency: costCurrency }
          : undefined;

      const completed = dbOperations.updateInCollection<WorkflowRun>('workflowRuns', run.id, {
        status: 'completed',
        completedAt: now(),
        output,
        toastMessages: toasts.length > 0 ? toasts : undefined,
        costEstimate,
      });
      addActivity({
        type: 'workflow.run.completed',
        title: 'Workflow completed',
        message: toasts.length > 0 ? toasts[toasts.length - 1] : `${workflow.name} completed successfully.`,
        tone: 'green',
        entityType: 'workflow',
        entityId: workflow.id,
      });
      return completed ?? { ...run, status: 'completed', completedAt: now(), output, toastMessages: toasts.length > 0 ? toasts : undefined, costEstimate };
    } catch (error) {
      const failed = dbOperations.updateInCollection<WorkflowRun>('workflowRuns', run.id, {
        status: 'failed',
        completedAt: now(),
        error: error instanceof Error ? error.message : String(error),
      });
      addActivity({
        type: 'workflow.run.failed',
        title: 'Workflow failed',
        message: `${workflow.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        tone: 'red',
        entityType: 'workflow',
        entityId: workflow.id,
      });
      return failed ?? { ...run, status: 'failed', completedAt: now(), error: String(error) };
    }
  };

  // Resolve a dot-separated selector path (e.g. "node-abc.text") from a context object
  function resolveDataSelector(selector: string, ctx: Record<string, unknown>): unknown {
    if (!selector) return ctx;
    const parts = selector.split('.');
    let current: unknown = ctx;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  const getAudioModel = async (
    modelId: string,
    runtime?: RuntimeType
  ): Promise<{ adapter: AudioAdapter; model: Model } | undefined> => {
    const match = await adapterRegistry.findModel(modelId, runtime);
    if (!match) {
      return undefined;
    }

    return {
      adapter: match.adapter as AudioAdapter,
      model: match.model,
    };
  };

  const getVideoModel = async (
    modelId: string,
    runtime?: RuntimeType
  ): Promise<{ adapter: VideoAdapter; model: Model } | undefined> => {
    const match = await adapterRegistry.findModel(modelId, runtime);
    if (!match) {
      return undefined;
    }

    return {
      adapter: match.adapter as VideoAdapter,
      model: match.model,
    };
  };
  

  return { runWorkflow, getAudioModel, getVideoModel };
}
