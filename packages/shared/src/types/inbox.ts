// ============================================
// Inbox Types
// ============================================

export type InboxProvider =
  | 'email'
  | 'gmail'
  | 'apple-mail'
  | 'reddit'
  | 'x'
  | 'youtube'
  | 'slack'
  | 'discord'
  | 'telegram';

export type InboxFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'trash';

export interface InboxAccount {
  id: string;
  provider: InboxProvider;
  integrationId: string;
  label: string;
  email?: string;
  username?: string;
  channelId?: string;
  status: 'connected' | 'disconnected' | 'needs_auth';
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxMessage {
  id: string;
  accountId: string;
  provider: InboxProvider;
  folder: InboxFolder;
  from: string;
  to?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  threadId?: string;
  read: boolean;
  starred: boolean;
  attachments?: Array<{
    name: string;
    url: string;
    mimeType?: string;
    size?: number;
  }>;
  providerMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxSummary {
  totalUnread: number;
  totalStarred: number;
  accounts: Array<{
    accountId: string;
    label: string;
    provider: InboxProvider;
    unread: number;
  }>;
}