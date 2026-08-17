// ============================================
// Activity Types
// ============================================

export type ActivityTone = 'green' | 'purple' | 'cyan' | 'amber' | 'pink' | 'red' | 'neutral';

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  tone: ActivityTone;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  userId?: string;
  projectId?: string;
  workspaceId?: string;
  repoId?: string;
  sessionId?: string;
  environment?: string;
  attributes?: Record<string, unknown>;
  cost?: {
    model?: string;
    provider?: string;
    unit?: string;
    amount?: number;
    currency?: string;
  };
  flagKey?: string;
  flagVariation?: string;
  flagValue?: unknown;
  flagRule?: string;
}