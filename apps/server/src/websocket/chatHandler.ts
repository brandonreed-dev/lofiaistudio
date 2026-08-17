import { WebSocket } from 'ws';
import { OllamaAdapter } from '../adapters/ollama.js';
import { dbOperations } from '../db/index.js';
import { loadEnabledAgentSkills, loadEnabledAgentWorkflows, runAgentToolChat } from '../agentChatTools.js';
import type { Agent, ChatMessage, TextGenerationParams } from '@lofiaistudio/shared';

interface ChatPayload {
  modelId: string;
  messages: ChatMessage[];
  params?: TextGenerationParams;
  requestId: string;
  systemPrompt?: string;
  agentId?: string;
}

export async function handleChatMessage(
  ws: WebSocket,
  payload: ChatPayload,
  adapter: OllamaAdapter,
  port: string | number
) {
  const { modelId, messages, params: rawParams, requestId, systemPrompt, agentId } = payload;
  const params = rawParams ?? {};

  const messagesWithSystem = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt, id: 'system', timestamp: new Date() }, ...messages]
    : messages;

  const apiBaseUrl = process.env.LOFIAI_API_SELF_ORIGIN ?? `http://127.0.0.1:${port}`;
  const agentIdStr = typeof agentId === 'string' ? agentId : undefined;
  const agent = agentIdStr ? dbOperations.getCollection<Agent>('agents').find((a) => a.id === agentIdStr) : undefined;
  const skills = loadEnabledAgentSkills(agentIdStr);
  const workflows = loadEnabledAgentWorkflows(agentIdStr);

  const sendToken = (token: string) => {
    ws.send(JSON.stringify({ type: 'token', requestId, token }));
  };
  const sendError = (error: string) => {
    ws.send(JSON.stringify({ type: 'error', requestId, error }));
  };
  const sendComplete = (content: string) => {
    ws.send(JSON.stringify({ type: 'complete', requestId, content }));
  };

  const hasAgentCapabilities = agent && (
    agent.capabilities?.skillRead ||
    agent.capabilities?.skillCreate ||
    agent.capabilities?.skillUpdate ||
    agent.capabilities?.skillDelete
  );

  if (skills.length > 0 || workflows.length > 0 || hasAgentCapabilities) {
    try {
      const baseMessages = messagesWithSystem
        .filter((m) => ['system', 'user', 'assistant'].includes(m.role))
        .map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: String(m.content ?? ''),
        }));

      const result = await runAgentToolChat({
        adapter,
        modelId,
        baseMessages,
        params,
        skills,
        workflows,
        agent,
        apiBaseUrl,
        onToken: sendToken,
      });

      sendComplete(result);
    } catch (toolErr) {
      console.warn('Tool-based agent chat failed, falling back to plain chat:', toolErr);
      try {
        const result = await adapter.chat(modelId, messagesWithSystem, params, sendToken);
        sendComplete(result);
      } catch (error) {
        sendError(error instanceof Error ? error.message : 'Unknown error');
      }
    }
    return;
  }

  try {
    const result = await adapter.chat(modelId, messagesWithSystem, params, sendToken);
    sendComplete(result);
  } catch (error) {
    sendError(error instanceof Error ? error.message : 'Unknown error');
  }
}