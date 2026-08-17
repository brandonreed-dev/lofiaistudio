// ============================================
// Skill Types
// ============================================

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  usedBy: number;
  runs7d: number;
  avgLatency: string;
  cost: string;
  enabled: boolean;
  executionType?: 'internal' | 'http' | 'workflow';
  endpoint?: string;
  method?: 'GET' | 'POST';
  workflowId?: string;
  configSchema?: Record<string, unknown>;
  runInputDefaults?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}