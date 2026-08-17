import { useEffect, useMemo, useState } from 'react';
import { useInboxStore } from '@/stores/inbox';
import type { InboxFolder } from '@lofiaistudio/shared';
import { Mail, MessageSquare, Rss, RefreshCw, Star, Search, Inbox, Send, FileText, Trash2, Archive } from 'lucide-react';
import { EmptyState, LoadingState } from '../panelPrimitives';

const PROVIDER_META: Record<string, { icon: typeof Mail; label: string; color: string }> = {
  email: { icon: Mail, label: 'Email', color: '#6366f1' },
  gmail: { icon: Mail, label: 'Gmail', color: '#ea4335' },
  'apple-mail': { icon: Mail, label: 'Apple Mail', color: '#a2aaad' },
  reddit: { icon: Rss, label: 'Reddit', color: '#ff4500' },
  x: { icon: MessageSquare, label: 'X', color: '#1da1f2' },
  youtube: { icon: MessageSquare, label: 'YouTube', color: '#ff0000' },
  slack: { icon: MessageSquare, label: 'Slack', color: '#4a154b' },
  discord: { icon: MessageSquare, label: 'Discord', color: '#5865f2' },
  telegram: { icon: MessageSquare, label: 'Telegram', color: '#26a5e4' },
};

const FOLDER_META: Record<string, { icon: typeof Inbox; label: string }> = {
  inbox: { icon: Inbox, label: 'Inbox' },
  sent: { icon: Send, label: 'Sent' },
  drafts: { icon: FileText, label: 'Drafts' },
  starred: { icon: Star, label: 'Starred' },
  archive: { icon: Archive, label: 'Archive' },
  trash: { icon: Trash2, label: 'Trash' },
};

export function InboxPanel() {
  const {
    accounts,
    messages,
    selectedAccountId,
    folder,
    searchQuery,
    isLoading,
    summary,
    loadAccounts,
    loadMessages,
    setSelectedAccount,
    setFolder,
    setSearchQuery,
    markRead,
    toggleStar,
    moveMessage,
    loadSummary,
  } = useInboxStore();

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    loadSummary();
  }, [loadAccounts, loadSummary]);

  useEffect(() => {
    loadMessages();
  }, [selectedAccountId, folder, loadMessages]);

  const visibleMessages = useMemo(() => {
    const list = selectedAccountId ? messages[selectedAccountId] ?? [] : messages['all'] ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => {
      const hay = [m.from, m.subject, m.snippet, m.body].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [messages, selectedAccountId, searchQuery]);

  const selectedMessage = useMemo(
    () => visibleMessages.find((m) => m.id === selectedMessageId) ?? null,
    [visibleMessages, selectedMessageId]
  );

  const unreadForAccount = (accountId?: string) =>
    (accountId ? messages[accountId] ?? [] : messages['all'] ?? []).filter((m) => !m.read).length;

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Inbox</h1>
          <p className="orch-view-subtitle">Messages from connected email, chat, and social providers.</p>
        </div>
        <div className="orch-view-actions">
          <button
            onClick={() => {
              loadAccounts();
              loadSummary();
            }}
            className="orch-btn"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="orch-grid orch-grid-3-1">
        {/* Sidebar */}
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">Folders</div>
          </div>
          <div className="orch-list">
            {Object.entries(FOLDER_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const count = key === 'inbox' ? summary?.totalUnread ?? 0 : undefined;
              return (
                <button
                  key={key}
                  onClick={() => setFolder(key as InboxFolder)}
                  className={`orch-row w-full${folder === key ? ' active' : ''}`}
                >
                  <div className="orch-row-icon"><Icon size={14} /></div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">{meta.label}</div>
                  </div>
                  {typeof count === 'number' && count > 0 && (
                    <span className="orch-chip blue">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="orch-card-header" style={{ borderBottom: 'none' }}>
            <div className="orch-card-title" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>Accounts</div>
          </div>
          <div className="orch-list">
            <button
              onClick={() => setSelectedAccount(null)}
              className={`orch-row w-full${selectedAccountId === null ? ' active' : ''}`}
            >
              <Mail size={14} />
              <div className="orch-row-main">All</div>
              <span className="orch-chip blue">{summary?.totalUnread ?? 0}</span>
            </button>
            {accounts.map((account) => {
              const meta = PROVIDER_META[account.provider] ?? PROVIDER_META['email'];
              const Icon = meta.icon;
              const unread = unreadForAccount(account.id);
              return (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account.id)}
                  className={`orch-row w-full${selectedAccountId === account.id ? ' active' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: meta.color, marginRight: 8 }} />
                  <div className="orch-row-main">{account.label}</div>
                  <span className="orch-chip blue">{unread}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message list + detail */}
        <div className="orch-grid orch-grid-2-1">
          <div className="orch-card">
            <div className="orch-filter" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-c)' }}>
              <Search size={14} style={{ marginRight: 6 }} />
              <input
                className="orch-input"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div className="orch-list" style={{ maxHeight: 500, overflowY: 'auto' }}>
              {isLoading ? (
                <LoadingState />
              ) : visibleMessages.length === 0 ? (
                <EmptyState title="No messages." />
              ) : (
                visibleMessages.map((message) => {
                  const account = accounts.find((a) => a.id === message.accountId);
                  const meta = account ? PROVIDER_META[account.provider] : PROVIDER_META['email'];
                  return (
                    <div
                      key={message.id}
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        if (!message.read) markRead(message.id, true);
                      }}
                      className={`orch-row${selectedMessageId === message.id ? ' active' : ''}${!message.read ? ' unread' : ''}`}
                    >
                      <div className="orch-row-icon">
                        <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      </div>
                      <div className="orch-row-main">
                        <div className="orch-row-title">{message.from}</div>
                        <div className="orch-row-sub">{message.subject}</div>
                        <div className="orch-row-sub" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {message.snippet ?? message.body}
                      <span style={{ float: 'right', fontSize: 10, color: 'var(--text-3)' }}>
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title">
                {selectedMessage ? selectedMessage.subject : 'No message selected'}
              </div>
              {selectedMessage && (
                <div className="flex gap-1">
                  <button
                    className="orch-btn xs ghost"
                    onClick={() => toggleStar(selectedMessage.id, !selectedMessage.starred)}
                    title={selectedMessage.starred ? 'Unstar' : 'Star'}
                  >
                    <Star size={14} className={selectedMessage.starred ? 'text-yellow-400' : ''} />
                  </button>
                  <button
                    className="orch-btn xs ghost"
                    onClick={() => moveMessage(selectedMessage.id, 'archive')}
                    title="Archive"
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    className="orch-btn xs ghost"
                    onClick={() => moveMessage(selectedMessage.id, 'trash')}
                    title="Trash"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              )}
            </div>
            <div className="orch-card-body">
              {selectedMessage ? (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-1)' }}>
                  <div style={{ color: 'var(--text-3)', marginBottom: 8 }}>
                    {selectedMessage.from}
                    {selectedMessage.to && ` → ${selectedMessage.to}`}
                  </div>
                  <div className="whitespace-pre-wrap">{selectedMessage.body}</div>
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
                  <Mail size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <p>Select a message to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
