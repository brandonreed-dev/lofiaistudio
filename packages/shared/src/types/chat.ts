// ============================================
// Chat Types
// ============================================

import type { TextGenerationParams } from './params.js';

export interface ToolCallInfo extends Record<string, unknown> {
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
}

export interface ChatMemoryConfig {
  enabled: boolean;
  mode: 'none' | 'window' | 'summary' | 'hybrid';
  windowSize: number;
  summaryFrequency: number;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reactions?: Record<string, string[]>;
  toolCalls?: ToolCallInfo[];
  replyToId?: string | null;
  edited?: boolean;
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  agentAvatarUrl?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  modelId: string;
  systemPrompt?: string;
  parameters?: TextGenerationParams;
  memory?: ChatMemoryConfig;
  folderId?: string;
  pinnedMessageIds?: string[];
  tags?: string[];
  branchParentId?: string;
  branchRootId?: string;
  summary?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  color?: string;
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Group Chat Types
// ============================================

export interface GroupChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  roomId?: string;
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  agentAvatarUrl?: string;
  reactions?: Record<string, string[]>;
  replyToId?: string | null;
}

export interface GroupChatRoom {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
  turnOrder?: string[];
  messages: GroupChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  systemPrompt: string;
}

export interface GroupChatAgentInfo {
  id: string;
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  project?: string;
  avatar: string;
  avatarImageUrl?: string;
  colorA: string;
  colorB: string;
  skillIds: string[];
  workflowIds: string[];
  capabilities: AgentCapabilities;
}

export interface GroupChatServerRequest {
  payload: {
    roomId: string;
    messages: GroupChatMessage[];
    agents: GroupChatAgentInfo[];
    agentOrder: string[];
    rounds?: number;
    systemPrompt: string;
  };
}

// Import needed for GroupChatAgentInfo
import type { AgentCapabilities } from './agents.js';