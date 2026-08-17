import type { Agent, Skill, Workflow } from '@lofiaistudio/shared';
import { dbOperations } from '../db/index.js';

function toolFnNameForWorkflow(workflow: Workflow): string {
  return `w_${workflow.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** Build a simple JSON parameters schema from the workflow's skill nodes (their runInputDefaults merged). */
function buildWorkflowToolParameters(workflow: Workflow): Record<string, unknown> {
  // Gather params from skill nodes in the workflow
  const allSkills = dbOperations.getCollection<Skill>('skills');
  const properties: Record<string, unknown> = {};
  for (const node of workflow.nodes) {
    if (node.type === 'skill') {
      const skillId = String(node.config.skillId ?? '');
      const skill = allSkills.find((s) => s.id === skillId);
      if (skill?.runInputDefaults) {
        for (const [k, v] of Object.entries(skill.runInputDefaults)) {
          if (!(k in properties)) {
            properties[k] = {
              type: typeof v === 'number' ? 'number' : 'string',
              description: `${skill.name} — ${k}`,
            };
          }
        }
      }
    }
    // Also allow overriding node-level config values
    if (node.type.startsWith('model.')) {
      const cfg = node.config ?? {};
      for (const [k, v] of Object.entries(cfg)) {
        if (k === 'prompt' || k === 'text' || k === 'modelId') {
          if (!(k in properties)) {
            properties[k] = {
              type: typeof v === 'number' ? 'number' : 'string',
              description: `${node.label} — ${k}`,
            };
          }
        }
      }
    }
  }
  if (Object.keys(properties).length === 0) {
    return {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input to pass to the workflow' },
      },
    };
  }
  return { type: 'object', properties, required: Object.keys(properties) };
}

export function buildOllamaToolsFromWorkflows(workflows: Workflow[]): {
  tools: unknown[];
  toolNameToWorkflowId: Map<string, string>;
} {
  const toolNameToWorkflowId = new Map<string, string>();
  const tools = workflows.map((workflow) => {
    const name = toolFnNameForWorkflow(workflow);
    toolNameToWorkflowId.set(name, workflow.id);
    return {
      type: 'function',
      function: {
        name,
        description: `Workflow: ${workflow.name}. ${workflow.description || ''}`.trim(),
        parameters: buildWorkflowToolParameters(workflow),
      },
    };
  });
  return { tools, toolNameToWorkflowId };
}

export async function invokeWorkflowForAgentChat(
  workflow: Workflow,
  rawArgs: Record<string, unknown>,
  apiBaseUrl: string
): Promise<unknown> {
  const res = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/api/workflows/${encodeURIComponent(workflow.id)}/run`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual', input: rawArgs }),
    }
  );
  const data = (await res.json()) as { success?: boolean; error?: string; data?: unknown };
  if (!data.success) {
    throw new Error(data.error ?? `Workflow run failed (${res.status})`);
  }
  return data.data;
}

export function loadEnabledAgentWorkflows(agentId: string | undefined): Workflow[] {
  if (!agentId) return [];
  const agent = dbOperations.getCollection<Agent>('agents').find((a: Agent) => a.id === agentId);
  if (!agent?.workflowIds?.length) return [];
  const all = dbOperations.getCollection<Workflow>('workflows');
  return agent.workflowIds
    .map((id: string) => all.find((w: Workflow) => w.id === id))
    .filter((w: Workflow | undefined): w is Workflow => Boolean(w && w.enabled));
}
