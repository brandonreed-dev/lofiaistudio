// ============================================
// User / Account Types
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  lastActive?: string;
  provider?: 'clerk' | 'local' | 'oauth';
  externalId?: string;
  emailVerified?: boolean;
  organizationId?: string;
  title?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}
