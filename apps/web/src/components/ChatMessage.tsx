import { useState, useRef, useCallback } from 'react';
import { Copy, Download, Edit2, Check, X, Reply, ChevronDown, ChevronRight, Code2, Bookmark } from 'lucide-react';
import type { ChatMessage as ChatMessageType, ToolCallInfo } from '@lofiaistudio/shared';
import { VoiceOutput } from './VoiceOutput';
import { MarkdownRenderer } from './panels/chat/MarkdownRenderer';

interface ChatMessageProps {
  message: ChatMessageType;
  isGenerating: boolean;
  streamingContent: string;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  isLast?: boolean;
  ttsModelId?: string | null;
}

const EMOJI_REACTIONS = ['👍', '❤️', '😄', '🎉', '👀', '💡'];

function formatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ToolCallIndicator({ toolCalls }: { toolCalls?: ToolCallInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!toolCalls || toolCalls.length === 0) return null;

  const completed = toolCalls.filter(t => t.status === 'completed').length;
  const failed = toolCalls.filter(t => t.status === 'failed').length;
  const running = toolCalls.filter(t => t.status === 'running').length;

  return (
    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-2)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--text-2)', fontSize: 11, padding: 0,
        }}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>Tools: {completed} completed{failed > 0 ? `, ${failed} failed` : ''}{running > 0 ? `, ${running} running` : ''}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {toolCalls.map((tc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 6px', borderRadius: 4, background: 'var(--bg-2)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: tc.status === 'completed' ? 'var(--green)' : tc.status === 'failed' ? 'var(--red)' : 'var(--amber)',
              }} />
              <span>{tc.name}</span>
              {tc.durationMs && <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>{tc.durationMs}ms</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Extract code blocks from markdown text
function extractCodeBlocks(text: string): Array<{ lang: string; code: string; start: number; end: number }> {
  const blocks: Array<{ lang: string; code: string; start: number; end: number }> = [];
  const regex = /```(\w+)?\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    blocks.push({ lang: m[1] || '', code: m[2].replace(/\n$/, ''), start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}

function ReactionBar({ reactions, onReact, messageId }: {
  reactions?: Record<string, string[]>;
  onReact?: (messageId: string, emoji: string) => void;
  messageId: string;
}) {
  const [showPicker, setShowPicker] = useState(false);

  if (!onReact) return null;

  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {reactions && Object.entries(reactions).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReact(messageId, emoji)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            padding: '1px 5px', borderRadius: 8, border: '1px solid var(--border-c)',
            background: users.includes('self') ? 'var(--accent)' : 'transparent',
            color: 'var(--text-1)', cursor: 'pointer', fontSize: 11, lineHeight: '16px',
          }}
        >
          <span>{emoji}</span>
          <span style={{ fontSize: 10 }}>{users.length}</span>
        </button>
      ))}
      <button
        onClick={() => setShowPicker(!showPicker)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, borderRadius: 8, border: '1px solid var(--border-c)',
          background: 'transparent', cursor: 'pointer', color: 'var(--text-3)',
          fontSize: 12, lineHeight: 1,
        }}
      >
        +
      </button>
      {showPicker && (
        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          {EMOJI_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(messageId, emoji); setShowPicker(false); }}
              style={{
                width: 22, height: 22, borderRadius: 6, border: 'none',
                background: 'var(--bg-3)', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatMessageComponent({
  message,
  isGenerating,
  streamingContent,
  onReply,
  onEdit,
  onDelete,
  onReact,
  isLast,
  ttsModelId,
}: ChatMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
  const downloadAsFile = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${message.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const displayContent = message.role === 'assistant' && isLast && isGenerating && !message.content
    ? streamingContent
    : message.content;

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{
        display: 'flex',
        gap: 10,
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        position: 'relative',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: message.agentColor
            ? message.agentColor
            : isUser ? 'var(--accent)' : 'var(--bg-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-0)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
        title={message.agentName || (isUser ? 'You' : 'AI')}
      >
        {message.agentAvatarUrl ? (
          <img src={message.agentAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          message.agentName?.[0]?.toUpperCase() || (isUser ? 'U' : 'AI')
        )}
      </div>

      {/* Message Bubble */}
      <div style={{ maxWidth: '80%', minWidth: 0 }}>
        {/* Agent name label */}
        {message.agentName && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: message.agentColor || 'var(--text-2)',
            marginBottom: 2, marginLeft: isUser ? 'auto' : 2,
            textAlign: isUser ? 'right' : 'left',
          }}>
            {message.agentName}
          </div>
        )}

        {/* Reply indicator */}
        {message.replyToId && (
          <div style={{
            fontSize: 10, color: 'var(--text-3)', marginBottom: 2,
            paddingLeft: 8, borderLeft: '2px solid var(--border-c)',
          }}>
            Replying to a message
          </div>
        )}

        {/* Bubble */}
        <div
          style={{
            borderRadius: 10,
            padding: '10px 14px',
            background: isUser ? 'var(--accent)' : 'var(--bg-3)',
            color: 'var(--text-1)',
            position: 'relative',
            lineHeight: 1.5,
            fontSize: 13.5,
          }}
          className="orch-msg-group"
        >
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{
                  width: '100%', minHeight: 60, resize: 'vertical',
                  borderRadius: 6, border: '1px solid var(--border-c)',
                  background: 'var(--bg-2)', padding: '6px 8px',
                  fontSize: 13, color: 'var(--text-1)', outline: 'none',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button className="orch-btn xs ghost" onClick={handleCancelEdit}>
                  <X size={12} />Cancel
                </button>
                <button className="orch-btn xs primary" onClick={handleSaveEdit}>
                  <Check size={12} />Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <MarkdownRenderer content={displayContent || ''} streaming={isAssistant && isGenerating} />

              {/* Edited indicator */}
              {message.edited && (
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>(edited)</span>
              )}

              {/* Tool calls */}
              {isAssistant && message.toolCalls && <ToolCallIndicator toolCalls={message.toolCalls} />}

              {/* Reactions */}
              <ReactionBar reactions={message.reactions} onReact={onReact} messageId={message.id} />
            </>
          )}
        </div>

        {/* Timestamp + Actions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 2, fontSize: 10, color: 'var(--text-3)',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          padding: '0 4px', height: 20,
        }}>
          <span>{formatTime(message.timestamp)}</span>
          {showActions && !isEditing && (
            <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
              <button className="orch-icon-btn" style={{ width: 18, height: 18 }} title="Copy" onClick={() => copyToClipboard(message.content)}>
                <Copy size={10} />
              </button>
              {!isUser && extractCodeBlocks(message.content).length > 0 && (
                <button className="orch-icon-btn" style={{ width: 18, height: 18 }} title="Copy code blocks" onClick={() => {
                  const blocks = extractCodeBlocks(message.content);
                  const allCode = blocks.map(b => b.code).join('\n\n');
                  copyToClipboard(allCode);
                }}>
                  <Code2 size={10} />
                </button>
              )}
              <button className="orch-icon-btn" style={{ width: 18, height: 18 }} title="Download" onClick={() => downloadAsFile(message.content)}>
                <Download size={10} />
              </button>
              {isUser && onEdit && (
                <button className="orch-icon-btn" style={{ width: 18, height: 18 }} title="Edit" onClick={() => { setEditText(message.content); setIsEditing(true); }}>
                  <Edit2 size={10} />
                </button>
              )}
              {isAssistant && ttsModelId && (
                <VoiceOutput text={displayContent || ''} ttsModelId={ttsModelId} />
              )}
              {onReply && (
                <button className="orch-icon-btn" style={{ width: 18, height: 18 }} title="Reply" onClick={() => onReply(message.id)}>
                  <Reply size={10} />
                </button>
              )}
              {onDelete && (
                <button className="orch-icon-btn" style={{ width: 18, height: 18 }} title="Delete" onClick={() => onDelete(message.id)}>
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}