// ============================================
// Organization Types
// ============================================

export type OrganizationStatus = 'active' | 'suspended' | 'archived';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdBy: string;
  memberCount: number;
  status: OrganizationStatus;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrganizationMember {
  id: string;
  orgId: string;
  userId: string;
  role: OrganizationMemberRole;
  joinedAt: string;
  invitedBy?: string;
}

// ============================================
// Auth Provider Types
// ============================================

export type AuthProviderType = 'clerk' | 'local' | 'oauth';

export interface AuthProviderConfig {
  id: string;
  type: AuthProviderType;
  enabled: boolean;
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
  clerkWebhookSecret?: string;
  oauthProviders?: Array<{
    id: string;
    name: string;
    clientId?: string;
    clientSecret?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
  }>;
  createdAt: string;
  updatedAt: string;
}