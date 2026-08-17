import type { WebSocket } from 'ws';
import type { Agent, Skill, Workflow } from '@lofiaistudio/shared';
import type { GroupChatMessage, GroupChatAgentInfo } from '@lofiaistudio/shared';
import type { OllamaAdapter } from './adapters/ollama.js';
import { loadEnabledAgentSkills, loadEnabledAgentWorkflows, runAgentToolChat } from './agentChatTools.js';
import { dbOperations } from './db/index.js';

/**
 * Server-side group chat orchestrator.
 *
 * Takes a full conversation history + agent roster, then runs N rounds of
 * sequential agent turns. Each agent sees the complete conversation with full
 * speaker attribution so they can respond to each other naturally.
 *
 * Streams tokens back via `group_token` events and sends `group_turn` events
 * for UI feedback (agent X is thinking…).
 */
export class GroupChatOrchestrator {
  private readonly adapter: OllamaAdapter;
  private readonly ws: WebSocket;
  private readonly roomId: string;
  private readonly agents: GroupChatAgentInfo[];
  private readonly agentOrder: string[];
  private readonly rounds: number;
  private readonly systemPrompt: string;
  private readonly baseMessages: GroupChatMessage[];
  private readonly contextWindowSize: number;

  private messages: GroupChatMessage[];

  constructor(opts: {
    adapter: OllamaAdapter;
    ws: WebSocket;
    roomId: string;
    messages: GroupChatMessage[];
    agents: GroupChatAgentInfo[];
    agentOrder: string[];
    rounds: number;
    systemPrompt: string;
    contextWindowSize?: number;
  }) {
    this.adapter = opts.adapter;
    this.ws = opts.ws;
    this.roomId = opts.roomId;
    this.baseMessages = opts.messages;
    this.agents = opts.agents;
    this.agentOrder = opts.agentOrder;
    this.rounds = Math.max(1, Math.min(opts.rounds, 10));
    this.systemPrompt = opts.systemPrompt;
    this.contextWindowSize = opts.contextWindowSize ?? 40;
    this.messages = [...opts.messages];
  }

  /**
   * Run the full orchestration. Returns the final message list.
   */
  async run(): Promise<GroupChatMessage[]> {
    const agentMap = new Map(this.agents.map((a) => [a.id, a]));

    for (let round = 1; round <= this.rounds; round++) {
      for (let turnIdx = 0; turnIdx < this.agentOrder.length; turnIdx++) {
        const agentId = this.agentOrder[turnIdx];
        const agent = agentMap.get(agentId);
        if (!agent) continue;

        // Emit turn-started event
        this.emitTurnEvent(agent, round, turnIdx, 'started');

        // Build the turn result (assistant message)
        const turnMessage = await this.executeAgentTurn(agent, round);

        // Append the turn's response to the shared history
        this.messages.push(turnMessage);

        // Emit turn-completed event
        this.emitTurnEvent(agent, round, turnIdx, 'completed');
      }
    }

    // Emit finished event with all final messages
    this.emitFinished();
    return this.messages;
  }

  private async executeAgentTurn(
    agent: GroupChatAgentInfo,
    round: number,
  ): Promise<GroupChatMessage> {
    const assistantMsg: GroupChatMessage = {
      id: crypto.randomUUID(),
      roomId: this.roomId,
      role: 'assistant',
      agentId: agent.id,
      agentName: agent.name,
      agentColor: `linear-gradient(135deg, ${agent.colorA}, ${agent.colorB})`,
      content: '',
      timestamp: new Date(),
    };

    // Build participant roster description
    const roster = this.agents
      .map((a) => {
        const isSelf = a.id === agent.id;
        return `- ${a.name}${isSelf ? ' (you)' : ''}: ${a.role}`;
      })
      .join('\n');

    // Build conversation history with speaker attribution
    const historyLines: string[] = [];
    const recentMessages = this.contextWindowSize > 0
      ? this.messages.slice(-this.contextWindowSize)
      : this.messages;

    for (const msg of recentMessages) {
      if (msg.role === 'system') continue;
      if (msg.role === 'user') {
        historyLines.push(`User: ${msg.content}`);
      } else if (msg.agentName) {
        historyLines.push(`${msg.agentName}: ${msg.content}`);
      } else {
        historyLines.push(`Assistant: ${msg.content}`);
      }
    }

    // Construct the full prompt for this agent
    const conversationHistory = historyLines.join('\n');
    const turnPrompt = `You are ${agent.name}.
Your role: ${agent.role}

You are participating in a group conversation with the following participants:
${roster}

=== Conversation History ===
${conversationHistory}

=== Current Turn (Round ${round}) ===
Now it's YOUR turn, ${agent.name}. Continue the conversation naturally, responding to points made by the user or other participants if appropriate. Do NOT prefix your response with your name. Just speak as ${agent.name}.`;

    try {
      // Determine if this agent has tools (skills/workflows)
      const skills = loadEnabledAgentSkills(agent.id);
      const workflows = loadEnabledAgentWorkflows(agent.id);
      const capSkillRead = agent.capabilities?.skillRead ?? false;
      const capSkillCreate = agent.capabilities?.skillCreate ?? false;
      const capSkillUpdate = agent.capabilities?.skillUpdate ?? false;
      const capSkillDelete = agent.capabilities?.skillDelete ?? false;
      const capProjectRead = agent.capabilities?.projectRead ?? false;
      const capProjectWrite = agent.capabilities?.projectWrite ?? false;
      const hasAgentLevelTools = capSkillRead || capSkillCreate || capSkillUpdate || capSkillDelete || capProjectRead || capProjectWrite;
      const hasToolSkills = skills.length > 0;
      const hasToolWorkflows = workflows.length > 0;
      const hasTools = hasToolSkills || hasToolWorkflows || hasAgentLevelTools;

      if (hasTools) {
        // Build a synthetic Agent record for runAgentToolChat
        const fullAgent: Agent = {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          model: agent.model,
          systemPrompt: agent.systemPrompt ?? '',
          status: 'active',
          project: agent.project ?? '',
          avatar: agent.avatar,
          avatarImageUrl: agent.avatarImageUrl,
          colorA: agent.colorA,
          colorB: agent.colorB,
          skillIds: agent.skillIds,
          workflowIds: agent.workflowIds,
          runCount: 0,
          capabilities: {
            skillRead: capSkillRead,
            skillCreate: capSkillCreate,
            skillUpdate: capSkillUpdate,
            skillDelete: capSkillDelete,
            projectRead: capProjectRead,
            projectWrite: capProjectWrite,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const baseMessages = [
          { role: 'system' as const, content: turnPrompt },
          { role: 'user' as const, content: 'Continue the conversation.' },
        ];

        const result = await runAgentToolChat({
          adapter: this.adapter,
          modelId: agent.model,
          baseMessages,
          params: {},
          skills,
          workflows,
          agent: fullAgent,
          apiBaseUrl: process.env.LOFIAI_API_SELF_ORIGIN ?? 'http://127.0.0.1:3001',
          onToken: (token: string) => {
            this.ws.send(JSON.stringify({
              type: 'group_token',
              payload: { roomId: this.roomId, agentId: agent.id, token },
            }));
          },
        });

        assistantMsg.content = result;
      } else {
        // Plain chat (no tools) — use streaming chat
        const result = await this.adapter.chat(
          agent.model,
          [
            { id: 'system', role: 'system' as const, content: turnPrompt, timestamp: new Date() },
            { id: 'user-prompt', role: 'user' as const, content: 'Continue the conversation.', timestamp: new Date() },
          ],
          {},
          (token: string) => {
            this.ws.send(JSON.stringify({
              type: 'group_token',
              payload: { roomId: this.roomId, agentId: agent.id, token },
            }));
          },
        );

        assistantMsg.content = result;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[GroupChat] Agent ${agent.name} turn error:`, errMsg);
      assistantMsg.content = `[Error: ${errMsg}]`;
    }

    return assistantMsg;
  }

  private emitTurnEvent(
    agent: GroupChatAgentInfo,
    round: number,
    turnIndex: number,
    status: 'started' | 'completed',
  ): void {
    try {
      this.ws.send(JSON.stringify({
        type: 'group_turn',
        payload: {
          roomId: this.roomId,
          agentId: agent.id,
          agentName: agent.name,
          round,
          totalRounds: this.rounds,
          turnIndex,
          totalAgents: this.agentOrder.length,
          status,
        },
      }));
    } catch {
      // WebSocket may be closed
    }
  }

  private emitFinished(): void {
    try {
      this.ws.send(JSON.stringify({
        type: 'group_finished',
        payload: {
          roomId: this.roomId,
          finalMessages: this.messages,
        },
      }));
    } catch {
      // WebSocket may be closed
    }
  }
}