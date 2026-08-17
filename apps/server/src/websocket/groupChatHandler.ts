import { WebSocket } from 'ws';
import { OllamaAdapter } from '../adapters/ollama.js';
import { GroupChatOrchestrator } from '../groupChatOrchestrator.js';
import type { GroupChatServerRequest } from '@lofiaistudio/shared';

export async function handleGroupChatMessage(
  ws: WebSocket,
  payload: GroupChatServerRequest['payload'],
  adapter: OllamaAdapter
) {
  const resolvedAgents = payload.agents;
  const agentOrder = payload.agentOrder.length > 0 ? payload.agentOrder : payload.agents.map(a => a.id);
  const rounds = payload.rounds || 1;

  console.log(`[GroupChat] Starting orchestration for room ${payload.roomId} with ${resolvedAgents.length} agents, ${rounds} round(s)`);

  const orchestrator = new GroupChatOrchestrator({
    adapter,
    ws,
    roomId: payload.roomId,
    messages: payload.messages,
    agents: resolvedAgents,
    agentOrder,
    rounds,
    systemPrompt: payload.systemPrompt,
    contextWindowSize: 40,
  });

  try {
    await orchestrator.run();
    console.log(`[GroupChat] Finished orchestration for room ${payload.roomId}`);
  } catch (err) {
    console.error(`[GroupChat] Orchestration failed for room ${payload.roomId}:`, err);
    ws.send(JSON.stringify({
      type: 'error',
      requestId: payload.roomId,
      error: err instanceof Error ? err.message : 'Group chat orchestration failed',
    }));
  }
}