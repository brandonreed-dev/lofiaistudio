// ============================================
// Webhook Types
// ============================================

export interface Webhook {
  id: string;
  name: string;
  workflowId: string;
  token: string;
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}