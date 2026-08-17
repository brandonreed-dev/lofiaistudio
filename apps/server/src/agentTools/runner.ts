import type { Agent, Skill, Workflow, TextGenerationParams } from '@lofiaistudio/shared';
import { dbOperations } from '../db/index.js';
import type { OllamaAdapter, OllamaChatApiMessage } from '../adapters/ollama.js';
import { MAX_TOOL_ROUNDS, MGMT_MUTATION_TOOL_IDS, MGMT_SKILL_READ, TOOL_SYSTEM_HINT } from './constants.js';
import { buildOllamaToolsFromSkills, invokeSkillForAgentChat } from './skillTools.js';
import { buildOllamaToolsFromWorkflows, invokeWorkflowForAgentChat } from './workflowTools.js';
import { handleUserMgmtIntent, safeBuildManagementTools } from './managementTools.js';
import { safeBuildProjectTools } from './projectTools.js';
import { chunkTextForStream, extractQuotedName, findSkillByIdOrName } from './utils.js';

export async function runAgentToolChat(options: {
  adapter: OllamaAdapter;
  modelId: string;
  baseMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  params: TextGenerationParams;
  skills: Skill[];
  workflows: Workflow[];
  /** Optional Agent record. If provided, management capabilities are injected as built-in tools. */
  agent?: Agent;
  apiBaseUrl: string;
  onToken: (t: string) => void;
}): Promise<string> {
  // Build tools from skills and workflows
  const { tools: skillTools, toolNameToSkillId } = buildOllamaToolsFromSkills(options.skills);
  const { tools: workflowTools, toolNameToWorkflowId } = buildOllamaToolsFromWorkflows(options.workflows);
  const allTools = [...skillTools, ...workflowTools];

  // Build management tools from agent capabilities if available
  let mgmtHandlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  if (options.agent) {
    const mgmt = safeBuildManagementTools(options.agent);
    allTools.push(...mgmt.tools);
    mgmtHandlers = mgmt.handlers;

    // Build project management tools for agents assigned to the LoFi AI Studio reference project.
    // Agents have a `project` field that stores the project name (e.g. "LoFi AI Studio").
    if (options.agent.project === 'LoFi AI Studio') {
      const proj = safeBuildProjectTools(options.agent);
      allTools.push(...proj.tools);
      for (const [key, handler] of proj.handlers) {
        mgmtHandlers.set(key, handler);
      }
    }
  }

  // Edge case: if there are no tools at all but we entered this function, return a plain response
  if (allTools.length === 0) {
    return 'No tools are available for this agent.';
  }

  const allSkillsById = new Map(options.skills.map((s) => [s.id, s]));
  const allWorkflowsById = new Map(options.workflows.map((w) => [w.id, w]));

  // Snapshot of skills before any tool calls, for hallucination verification
  const skillsSnapshot = new Set(dbOperations.getCollection<Skill>('skills').map((s) => `${s.id}:${s.name}`));

  const ollamaMessages: OllamaChatApiMessage[] = [];
  if (options.baseMessages[0]?.role === 'system') {
    // Remove the CRITICAL RULE part from the hint since we handle this server-side now
    const cleanHint = TOOL_SYSTEM_HINT;
    ollamaMessages.push({
      role: 'system',
      content: `${options.baseMessages[0].content}\n\n${cleanHint}`,
    });
    ollamaMessages.push(
      ...options.baseMessages.slice(1).map((m) => ({ role: m.role, content: m.content }))
    );
  } else {
    ollamaMessages.push({ role: 'system', content: TOOL_SYSTEM_HINT });
    ollamaMessages.push(...options.baseMessages.map((m) => ({ role: m.role, content: m.content })));
  }

  // â”€â”€ Pre-process user message for management intent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Bypass the model's inability to call Ollama function tools by intercepting
  // management requests directly from the user's text.
  const lastUserMsg = [...options.baseMessages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg && options.agent) {
    const mgmtResult = handleUserMgmtIntent(lastUserMsg.content, options.agent);
    if (mgmtResult) {
      // Management intent detected and handled. Inject the result and let the model
      // generate a natural-language response based on the real outcome.
      console.log(`[runAgentToolChat] Intercepted management intent: ${mgmtResult.toolName}`);

      // Pre-seed the conversation with the tool call and its result
      ollamaMessages.push({
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            function: {
              name: mgmtResult.toolName,
              arguments: '{}',
            },
          },
        ],
      } as unknown as OllamaChatApiMessage);
      ollamaMessages.push({
        role: 'tool',
        content: mgmtResult.toolContent,
        tool_name: mgmtResult.toolName,
      });

      // Update the successfulMgmtCalls tracker for the post-loop verification
      try {
        const parsed = JSON.parse(mgmtResult.toolContent) as Record<string, unknown>;
        if (parsed.success === true && MGMT_MUTATION_TOOL_IDS.has(mgmtResult.toolName)) {
          // Skill was mutated â€” update snapshot expectations
          // (We'll just let the final DB check pass since the DB actually changed)
        }
      } catch {
        // ignore
      }

      // If this was a read-only operation, just return the data directly
      if (mgmtResult.toolName === MGMT_SKILL_READ) {
        const allSkills = dbOperations.getCollection<Skill>('skills');
        const skillName = extractQuotedName(lastUserMsg.content);
        let responseText: string;
        if (skillName) {
          const skill = findSkillByIdOrName(allSkills, skillName);
          if (skill) {
            responseText = `Yes, I can see "${skill.name}" (category: ${skill.category}, type: ${skill.executionType}, enabled: ${skill.enabled}).`;
          } else {
            responseText = `No, I don't see a skill named "${skillName}". The available skills are: ${allSkills.map((s) => `"${s.name}"`).join(', ')}.`;
          }
        } else {
          responseText = `Here are the installed skills: ${allSkills.map((s) => `"${s.name}" (${s.category}, ${s.executionType})`).join(', ')}.`;
        }
        for (const chunk of chunkTextForStream(responseText)) {
          options.onToken(chunk);
        }
        return responseText;
      }
    }
  }

  let round = 0;
  while (round < MAX_TOOL_ROUNDS) {
    let resultMessage: OllamaChatApiMessage | undefined;

    try {
      const response = await options.adapter.chatCompleteRound(
        options.modelId,
        ollamaMessages,
        options.params,
        allTools
      );
      resultMessage = response.message;
    } catch (err) {
      // If Ollama tool-calling fails, gracefully return the error text
      const errorText = `I encountered an error while processing tools: ${err instanceof Error ? err.message : String(err)}. Please try again or rephrase your request.`;
      for (const chunk of chunkTextForStream(errorText)) {
        options.onToken(chunk);
      }
      return errorText;
    }

    if (!resultMessage) {
      const errorText = 'The model did not return a response. Please try again.';
      for (const chunk of chunkTextForStream(errorText)) {
        options.onToken(chunk);
      }
      return errorText;
    }

    const toolCalls = resultMessage.tool_calls;
    if (!toolCalls?.length) {
      const text = resultMessage.content ?? '';
      for (const chunk of chunkTextForStream(text)) {
        options.onToken(chunk);
      }
      return text;
    }

    ollamaMessages.push({
      role: 'assistant',
      content: resultMessage.content ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_calls: toolCalls as any,
    });

    for (const tc of toolCalls) {
      const fn = tc.function;
      if (!fn?.name) continue;

      let toolContent: string;
      try {
        let args: Record<string, unknown> = {};
        try {
          args = fn.arguments ? (JSON.parse(fn.arguments) as Record<string, unknown>) : {};
        } catch {
          args = {};
        }

        // 1. Check if this is a management tool (agent capabilities)
        const mgmtHandler = mgmtHandlers.get(fn.name);
        if (mgmtHandler) {
          const out = await mgmtHandler(args);
          toolContent = typeof out === 'string' ? out : JSON.stringify(out);
        } else {
          // 2. Check if this is a skill tool
          const skillId = toolNameToSkillId.get(fn.name);
          if (skillId) {
            const skill = allSkillsById.get(skillId);
            if (!skill) {
              toolContent = JSON.stringify({ error: `Unknown skill tool: ${fn.name}` });
            } else {
              const out = await invokeSkillForAgentChat(skill, args, options.apiBaseUrl);
              toolContent = typeof out === 'string' ? out : JSON.stringify(out);
              const newRuns = (skill.runs7d ?? 0) + 1;
              dbOperations.updateInCollection<Skill>('skills', skill.id, {
                runs7d: newRuns,
                usedBy: Math.max(skill.usedBy ?? 0, 1),
              } as Partial<Skill>);
            }
          } else {
            // 3. Check if this is a workflow tool
            const workflowId = toolNameToWorkflowId.get(fn.name);
            if (workflowId) {
              const workflow = allWorkflowsById.get(workflowId);
              if (!workflow) {
                toolContent = JSON.stringify({ error: `Unknown workflow tool: ${fn.name}` });
              } else {
                const out = await invokeWorkflowForAgentChat(workflow, args, options.apiBaseUrl);
                toolContent = typeof out === 'string' ? out : JSON.stringify(out);
              }
            } else {
              toolContent = JSON.stringify({ error: `Unknown tool: ${fn.name}` });
            }
          }
        }
      } catch (err) {
        toolContent = JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        });
      }
      ollamaMessages.push({ role: 'tool', content: toolContent, tool_name: fn.name });
    }
    round++;
  }

  // If we exhausted all rounds but still have partial conversation, return the last assistant text
  const lastText = ollamaMessages
    .filter((m): m is { role: 'assistant'; content: string } => m.role === 'assistant' && typeof m.content === 'string')
    .pop()?.content ?? 'I exceeded the maximum number of tool call rounds. Please try breaking your request into smaller steps.';

  // â”€â”€ Final DB-verified check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const skillsAfter = new Set(dbOperations.getCollection<Skill>('skills').map((s) => `${s.id}:${s.name}`));
  const skillsChanged =
    skillsSnapshot.size !== skillsAfter.size ||
    !Array.from(skillsSnapshot).every((key) => skillsAfter.has(key));
  if (
    /\b(creat(ed|e)|delet(e|ed)|remov(e|ed)|updat(e|ed))\b/i.test(lastText) &&
    /\b(skill|skills)\b/i.test(lastText) &&
    !skillsChanged
  ) {
    const correctedText = 'I was unable to complete that management operation. The skill database was not modified. Please check that the skill name is correct and try again, or use the Skills panel in the UI to manage skills directly.';
    for (const chunk of chunkTextForStream(correctedText)) {
      options.onToken(chunk);
    }
    return correctedText;
  }

  for (const chunk of chunkTextForStream(lastText)) {
    options.onToken(chunk);
  }
  return lastText;
}
