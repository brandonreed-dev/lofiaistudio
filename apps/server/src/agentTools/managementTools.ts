import type { Agent, Skill } from '@lofiaistudio/shared';
import { v4 as uuidv4 } from 'uuid';
import { dbOperations } from '../db/index.js';
import { MGMT_SKILL_CREATE, MGMT_SKILL_DELETE, MGMT_SKILL_READ, MGMT_SKILL_UPDATE } from './constants.js';
import { extractQuotedName, findSkillByIdOrName, normalizeQuery } from './utils.js';

/**
 * Pre-process a user message for skill management intent.
 * Returns a tool response that can be injected into the conversation,
 * or null if no management intent is detected.
 * This bypasses the model's inability to call Ollama function tools for management.
 */
export function handleUserMgmtIntent(
  userText: string,
  agent: Agent | undefined
): { toolName: string; toolContent: string } | null {
  if (!agent?.capabilities) return null;

  const text = userText.trim();
  const lower = text.toLowerCase();

  // ── DELETE skill ──────────────────────────────────────────────────────────────
  // Patterns: "delete skill X", "delete the skill named X", "remove skill X"
  if (agent.capabilities.skillDelete && /^(delete|remove)\b/i.test(lower)) {
    const skillName = extractQuotedName(text) ?? text.replace(/^(delete|remove)\s+(the\s+)?skill\s+/i, '').trim();
    if (skillName) {
      // Try direct ID match first, then case-insensitive name
      let result = dbOperations.deleteFromCollection('skills', skillName);
      if (!result) {
        const allSkills = dbOperations.getCollection<Skill>('skills');
        const skill = allSkills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
        if (skill) {
          result = dbOperations.deleteFromCollection('skills', skill.id);
        }
      }
      if (result) {
        return {
          toolName: MGMT_SKILL_DELETE,
          toolContent: JSON.stringify({ success: true, deleted: skillName }),
        };
      } else {
        // Skill not found — list available skills to help the user
        const allSkills = dbOperations.getCollection<Skill>('skills');
        const names = allSkills.map((s) => s.name);
        return {
          toolName: MGMT_SKILL_DELETE,
          toolContent: JSON.stringify({
            error: `Skill "${skillName}" not found.`,
            availableSkills: names,
          }),
        };
      }
    }
  }

  // ── CREATE skill ──────────────────────────────────────────────────────────────
  // Patterns: "create skill called X", "create skill X", "make a skill named X"
  if (agent.capabilities.skillCreate && /^(create|make)\b/i.test(lower)) {
    const skillName = extractQuotedName(text) ?? text.replace(/^(create|make)\s+(a\s+)?skill\s+(called|named)?\s*/i, '').trim();
    if (skillName && skillName.length > 0) {
      // Extract description if present
      let description = '';
      const descMatch = text.match(/(?:description|desc)\s+(?:of|to be)?\s*[""']?([^""'"]+)[""']?/i);
      if (descMatch) description = descMatch[1].trim();

      // Determine execution type from text keywords
      let executionType: Skill['executionType'] = 'internal';
      if (/\binternal\b/i.test(lower)) executionType = 'internal';
      else if (/\bhttp\b/i.test(lower)) executionType = 'http';
      else if (/\bworkflow\b/i.test(lower)) executionType = 'workflow';

      const stamp = new Date().toISOString();
      const skill = {
        id: `skill-${uuidv4()}`,
        name: skillName,
        category: 'Custom',
        description: description || '',
        usedBy: 0,
        runs7d: 0,
        avgLatency: '—',
        cost: 'Free',
        enabled: true,
        executionType,
        endpoint: undefined,
        method: 'POST' as const,
        workflowId: undefined,
        runInputDefaults: undefined,
        configSchema: undefined,
        createdAt: stamp,
        updatedAt: stamp,
      } as Skill;
      dbOperations.addToCollection('skills', skill);
      return {
        toolName: MGMT_SKILL_CREATE,
        toolContent: JSON.stringify({ success: true, skill: { id: skill.id, name: skill.name } }),
      };
    }
  }

  // ── UPDATE skill ──────────────────────────────────────────────────────────────
  // Patterns: "update skill X to have description Y", "update skill X ..."
  if (agent.capabilities.skillUpdate && /^update\b/i.test(lower)) {
    const skillName = extractQuotedName(text) ?? text.replace(/^update\s+(the\s+)?skill\s+/i, '').split(/\s+(?:to|with|set)/i)[0].trim();
    if (skillName) {
      const allSkills = dbOperations.getCollection<Skill>('skills');
      const skill = findSkillByIdOrName(allSkills, skillName);
      if (skill) {
        const updates: Partial<Skill> = {};
        // Check for description
        const descMatch = text.match(/(?:description|desc)\s+(?:of|to be)?\s*[""']?([^""'"]+)[""']?/i);
        if (descMatch) updates.description = descMatch[1].trim();
        // Check for category
        const catMatch = text.match(/(?:category)\s+(?:of|to be)?\s*[""']?([^""'"]+)[""']?/i);
        if (catMatch) updates.category = catMatch[1].trim();
        // Check for execution type
        const execMatch = text.match(/(?:executionType|execution type|execution)\s+(?:of|to be)?\s*[""']?([^""'"]+)[""']?/i);
        if (execMatch) {
          const et = execMatch[1].toLowerCase().trim();
          if (et === 'internal' || et === 'http' || et === 'workflow') {
            updates.executionType = et;
          }
        }
        // Check for enabled state
        if (/\benabled?\b/i.test(lower) && !/disabled?\b/i.test(lower)) updates.enabled = true;
        if (/\bdisabled?\b/i.test(lower)) updates.enabled = false;

        if (Object.keys(updates).length > 0) {
          dbOperations.updateInCollection('skills', skill.id, { ...updates, updatedAt: new Date().toISOString() });
          return {
            toolName: MGMT_SKILL_UPDATE,
            toolContent: JSON.stringify({ success: true, skill: { id: skill.id, name: skill.name, updates } }),
          };
        }
        return {
          toolName: MGMT_SKILL_UPDATE,
          toolContent: JSON.stringify({ error: 'No updatable fields found in your request. Specify what to update (e.g., description, category).' }),
        };
      }
      return {
        toolName: MGMT_SKILL_UPDATE,
        toolContent: JSON.stringify({ error: `Skill "${skillName}" not found.` }),
      };
    }
  }

  // ── READ/CHECK skill ──────────────────────────────────────────────────────────
  // Patterns: "do you see skill X", "list skills", "show skills", "what skills", "skill named X"
  if (agent.capabilities.skillRead) {
    // Listing all skills
    if (/^(?:list|show|what|do you have)\b/i.test(lower) && /\bskills?\b/i.test(lower)) {
      const allSkills = dbOperations.getCollection<Skill>('skills');
      return {
        toolName: MGMT_SKILL_READ,
        toolContent: JSON.stringify({
          skills: allSkills.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            executionType: s.executionType,
            enabled: s.enabled,
            description: s.description,
          })),
        }),
      };
    }
    // Checking for a specific skill
    if (/(?:do you see|is there|find|look up)\b.*\bskill\b/i.test(lower)) {
      const skillName = extractQuotedName(text);
      if (skillName) {
        const allSkills = dbOperations.getCollection<Skill>('skills');
        const skill = findSkillByIdOrName(allSkills, skillName);
        if (skill) {
          return {
            toolName: MGMT_SKILL_READ,
            toolContent: JSON.stringify({ skill }),
          };
        }
        return {
          toolName: MGMT_SKILL_READ,
          toolContent: JSON.stringify({ error: `Skill "${skillName}" not found.` }),
        };
      }
    }
  }

  return null;
}

/**
 * Build built-in management function tools based on an agent's capabilities.
 * These are injected alongside regular skill/workflow tools during agent chat.
 */
export function buildManagementTools(agent: Agent): {
  tools: unknown[];
  handlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
} {
  const tools: unknown[] = [];
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

  if (agent.capabilities?.skillRead) {
    tools.push({
      type: 'function',
      function: {
        name: MGMT_SKILL_READ,
        description:
          'List all installed skills with their names, categories, execution types, and descriptions, or read the full definition of a specific skill by name or ID.',
        parameters: {
          type: 'object',
          properties: {
            skillName: {
              type: 'string',
              description:
                'Optional skill name or ID filter. If provided, returns full details of that one skill. If omitted, lists all skills.',
            },
          },
        },
      },
    });
    handlers.set(MGMT_SKILL_READ, async (args) => {
      const allSkills = dbOperations.getCollection<Skill>('skills');
      if (args.skillName) {
        const skill = findSkillByIdOrName(allSkills, String(args.skillName));
        if (!skill) return { error: `Skill "${args.skillName}" not found.` };
        return { skill };
      }
      return {
        skills: allSkills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          executionType: s.executionType,
          enabled: s.enabled,
          description: s.description,
        })),
      };
    });
  }

  if (agent.capabilities?.skillCreate) {
    tools.push({
      type: 'function',
      function: {
        name: MGMT_SKILL_CREATE,
        description:
          'Create a new skill. Provide name (required, use dot notation like "domain.check"), category, description, executionType (internal/http/workflow), endpoint+method for HTTP skills, workflowId for workflow skills, runInputDefaults as a JSON object, and configSchema as a JSON schema object.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name (required, use dot notation like "domain.check")' },
            category: { type: 'string', description: 'Category label (default: "Custom")' },
            description: { type: 'string', description: 'Description of what the skill does' },
            executionType: {
              type: 'string',
              enum: ['internal', 'http', 'workflow'],
              description: 'How the skill executes',
            },
            endpoint: { type: 'string', description: 'HTTP URL for http execution type. Use {param} for template slots' },
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method for http execution type' },
            workflowId: { type: 'string', description: 'ID of a workflow to trigger for workflow execution type' },
            runInputDefaults: {
              type: 'object',
              description: 'JSON object of default input parameters (fills URL template slots)',
            },
            configSchema: { type: 'object', description: 'JSON schema object describing expected input parameters' },
          },
          required: ['name'],
        },
      },
    });
    handlers.set(MGMT_SKILL_CREATE, async (args) => {
      if (!args.name || String(args.name).trim() === '') {
        return { error: 'Skill name is required. You must provide a name for the skill.' };
      }
      const stamp = new Date().toISOString();
      const skill = {
        id: `skill-${uuidv4()}`,
        name: String(args.name).trim(),
        category: String(args.category ?? 'Custom').trim(),
        description: String(args.description ?? ''),
        usedBy: 0,
        runs7d: 0,
        avgLatency: '—',
        cost: 'Free',
        enabled: true,
        executionType: (args.executionType ?? 'internal') as Skill['executionType'],
        endpoint: args.endpoint ? String(args.endpoint).trim() : undefined,
        method: (args.method ?? 'POST') as 'GET' | 'POST',
        workflowId: args.workflowId ? String(args.workflowId).trim() : undefined,
        runInputDefaults: (args.runInputDefaults as Record<string, unknown>) ?? undefined,
        configSchema: (args.configSchema as Record<string, unknown>) ?? undefined,
        createdAt: stamp,
        updatedAt: stamp,
      } as Skill;
      dbOperations.addToCollection('skills', skill);
      return { success: true, skill: { id: skill.id, name: skill.name } };
    });
  }

  if (agent.capabilities?.skillUpdate) {
    tools.push({
      type: 'function',
      function: {
        name: MGMT_SKILL_UPDATE,
        description:
          'Update an existing skill by ID or exact name. Provide the fields to update (name, category, description, executionType, endpoint, method, runInputDefaults, configSchema, enabled). Only provided fields will be changed.',
        parameters: {
          type: 'object',
          properties: {
            identifier: { type: 'string', description: 'Skill ID or exact name of the skill to update' },
            name: { type: 'string', description: 'New name for the skill' },
            category: { type: 'string', description: 'New category label' },
            description: { type: 'string', description: 'New description' },
            enabled: { type: 'boolean', description: 'Whether the skill is enabled' },
            executionType: {
              type: 'string',
              enum: ['internal', 'http', 'workflow'],
              description: 'How the skill executes',
            },
            endpoint: { type: 'string', description: 'HTTP URL for http execution type' },
            method: { type: 'string', enum: ['GET', 'POST'] },
            workflowId: { type: 'string', description: 'ID of a workflow to trigger' },
            runInputDefaults: { type: 'object', description: 'JSON object of default input parameters' },
            configSchema: { type: 'object', description: 'JSON schema object' },
          },
          required: ['identifier'],
        },
      },
    });
    handlers.set(MGMT_SKILL_UPDATE, async (args) => {
      // Try identifier first, then fall back to name (LLMs often drop "identifier" on subsequent calls)
      const query = normalizeQuery(args.identifier) || normalizeQuery(args.name);
      if (!query) return { error: 'A valid skill name or ID is required for updating. Please provide the name of the skill you want to update.' };
      const allSkills = dbOperations.getCollection<Skill>('skills');
      const skill = findSkillByIdOrName(allSkills, query);
      if (!skill) return { error: `Skill "${query}" not found.` };
      const updates: Partial<Skill> = {};
      const updatableKeys: (keyof Skill)[] = [
        'name', 'category', 'description', 'enabled', 'executionType',
        'endpoint', 'method', 'workflowId', 'runInputDefaults', 'configSchema',
      ];
      for (const key of updatableKeys) {
        if (key in args) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (updates as any)[key] = args[key];
        }
      }
      dbOperations.updateInCollection('skills', skill.id, updates);
      return { success: true, skill: { id: skill.id, name: updates.name ?? skill.name } };
    });
  }

  if (agent.capabilities?.skillDelete) {
    tools.push({
      type: 'function',
      function: {
        name: MGMT_SKILL_DELETE,
        description:
          'Delete a skill by ID or exact name. Use this when the user asks to remove or delete a skill.',
        parameters: {
          type: 'object',
          properties: {
            identifier: { type: 'string', description: 'Skill ID or exact name to delete' },
            confirm: {
              type: 'boolean',
              description: 'Must be true to confirm deletion.',
            },
          },
          required: ['identifier', 'confirm'],
        },
      },
    });
    handlers.set(MGMT_SKILL_DELETE, async (args) => {
      // Try identifier first, then fall back to name or skillName (LLMs often drop "identifier" on second call)
      const query = normalizeQuery(args.identifier) || normalizeQuery(args.name) || normalizeQuery(args.skillName);
      if (!query) {
        return { error: 'A valid skill name or ID is required for deletion. Please provide the name of the skill you want to delete.' };
      }
      if (!args.confirm) {
        return {
          message: `Deletion of skill "${query}" requires explicit confirmation. Ask the user to confirm, then call _mgmt_skill_delete again with BOTH "identifier" set to "${query}" AND "confirm" set to true.`,
        };
      }
      // Try direct ID match first, then case-insensitive name match
      let result = dbOperations.deleteFromCollection('skills', query);
      if (!result) {
        const allSkills = dbOperations.getCollection<Skill>('skills');
        const skill = allSkills.find(
          (s) => s.name.toLowerCase() === query.toLowerCase()
        );
        if (skill) {
          result = dbOperations.deleteFromCollection('skills', skill.id);
        } else {
          return { error: `Skill "${query}" not found.` };
        }
      }
      return { success: true, deleted: query };
    });
  }

  return { tools, handlers };
}

/**
 * Safe wrapper for buildManagementTools — returns empty arrays if
 * agent or capabilities is undefined, avoiding runtime crashes.
 */
export function safeBuildManagementTools(agent: Agent | undefined): {
  tools: unknown[];
  handlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
} {
  if (!agent || !agent.capabilities) {
    return { tools: [], handlers: new Map() };
  }
  return buildManagementTools(agent);
}
