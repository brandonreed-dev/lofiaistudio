import type { Agent, Skill } from '@lofiaistudio/shared';
import { dbOperations } from '../db/index.js';
import { executeHttpSkillRequest } from '../httpSkillExecutor.js';

function toolFnNameForSkill(skill: Skill): string {
  return `s_${skill.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function buildToolParameters(skill: Skill): Record<string, unknown> {
  if (skill.configSchema && typeof skill.configSchema === 'object' && 'type' in skill.configSchema) {
    return skill.configSchema as Record<string, unknown>;
  }
  const defaults = skill.runInputDefaults ?? {};
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(defaults)) {
    properties[k] = {
      type: typeof v === 'number' ? 'number' : 'string',
      description: k,
    };
  }
  if (Object.keys(properties).length === 0) {
    return {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Arguments as JSON string hints' },
      },
    };
  }
  return { type: 'object', properties, required: Object.keys(properties) };
}

export function buildOllamaToolsFromSkills(skills: Skill[]): {
  tools: unknown[];
  toolNameToSkillId: Map<string, string>;
} {
  const toolNameToSkillId = new Map<string, string>();
  const tools = skills.map((skill) => {
    const name = toolFnNameForSkill(skill);
    toolNameToSkillId.set(name, skill.id);
    return {
      type: 'function',
      function: {
        name,
        description: `${skill.name}. ${skill.description || ''}`.trim(),
        parameters: buildToolParameters(skill),
      },
    };
  });
  return { tools, toolNameToSkillId };
}

export async function invokeSkillForAgentChat(
  skill: Skill,
  rawArgs: Record<string, unknown>,
  apiBaseUrl: string
): Promise<unknown> {
  if (skill.executionType === 'http' && skill.endpoint) {
    const { status, result } = await executeHttpSkillRequest(skill, rawArgs, {});
    return { httpStatus: status, result };
  }
  if (skill.executionType === 'workflow' && skill.workflowId) {
    const res = await fetch(
      `${apiBaseUrl.replace(/\/$/, '')}/api/workflows/${encodeURIComponent(skill.workflowId)}/run`,
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
  return { note: 'Internal skill — no automatic execution in chat', skillName: skill.name };
}

export function loadEnabledAgentSkills(agentId: string | undefined): Skill[] {
  if (!agentId) return [];
  const agent = dbOperations.getCollection<Agent>('agents').find((a) => a.id === agentId);
  if (!agent?.skillIds?.length) return [];
  const all = dbOperations.getCollection<Skill>('skills');
  return agent.skillIds
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Skill => Boolean(s && s.enabled));
}
