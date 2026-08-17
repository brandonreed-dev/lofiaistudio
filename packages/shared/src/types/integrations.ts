// ============================================
// Integration Types
// ============================================

export interface Integration {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'disconnected' | 'needs_config';
  environment?: string;
  clientSideID?: string;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}