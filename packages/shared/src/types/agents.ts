// ============================================
// Agent Types
// ============================================

export type AgentStatus = 'active' | 'idle' | 'busy' | 'disabled';

export interface AgentCapabilities {
  skillRead: boolean;
  skillCreate: boolean;
  skillUpdate: boolean;
  skillDelete: boolean;
  projectRead: boolean;
  projectWrite: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  systemPrompt: string;
  status: AgentStatus;
  project: string;
  avatar: string;
  avatarImageUrl?: string;
  colorA: string;
  colorB: string;
  skillIds: string[];
  workflowIds: string[];
  runCount: number;
  capabilities: AgentCapabilities;
  ttsModel?: string;
  sttModel?: string;
  voiceModel?: string;
  greeting?: string;
  createdAt: string;
  updatedAt: string;
}