import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Upload } from 'lucide-react';
import type { Agent } from '@lofiaistudio/shared';
import { VoiceInput } from './VoiceInput';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFileUpload?: (files: FileList) => void;
  onVoiceTranscription?: (text: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
  placeholder?: string;
  agents?: Agent[];
  onAgentMention?: (agent: Agent) => void;
  sttModelId?: string | null;
}

type SlashCommand = {
  id: string;
  name: string;
  description: string;
  action: () => void;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onFileUpload,
  onVoiceTranscription,
  isGenerating,
  disabled,
  placeholder = 'Type a message...',
  agents = [],
  onAgentMention,
  sttModelId,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showCommands, setShowCommands] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  // Handle @mention detection
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentions || showCommands) {
        return;
      }
      onSubmit();
      return;
    }

    if (e.key === 'Escape') {
      setShowMentions(false);
      setShowCommands(false);
      return;
    }

    // Arrow up/down for mentions
    if (showMentions && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setMentionIndex(prev => {
        const filtered = getFilteredAgents();
        if (e.key === 'ArrowUp') return Math.max(0, prev - 1);
        return Math.min(filtered.length - 1, prev + 1);
      });
      return;
    }

    // Arrow up/down for commands
    if (showCommands && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setMentionIndex(prev => {
        if (e.key === 'ArrowUp') return Math.max(0, prev - 1);
        return Math.min(commands.length - 1, prev + 1);
      });
      return;
    }

    // @ mention trigger
    if (e.key === '@' && agents.length > 0) {
      setShowMentions(true);
      setMentionQuery('');
      setMentionIndex(0);
    }

    // / command trigger
    if (e.key === '/' && value === '') {
      setShowCommands(true);
      setMentionIndex(0);
    }
  };

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check if we're in a mention
    const cursorPos = e.target.selectionStart || 0;
    const beforeCursor = newValue.slice(0, cursorPos);
    const atMatch = beforeCursor.lastIndexOf('@');

    if (atMatch >= 0 && !beforeCursor.slice(atMatch).includes(' ')) {
      const query = beforeCursor.slice(atMatch + 1);
      setShowMentions(true);
      setMentionQuery(query);
      setMentionIndex(0);
    } else if (atMatch >= 0 && beforeCursor.slice(atMatch).includes(' ')) {
      setShowMentions(false);
    } else if (newValue === '/') {
      setShowCommands(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  }, [onChange]);

  const getFilteredAgents = useCallback(() => {
    if (!mentionQuery) return agents;
    const q = mentionQuery.toLowerCase();
    return agents.filter(
      a => a.name.toLowerCase().includes(q) ||
           a.role.toLowerCase().includes(q) ||
           a.model.toLowerCase().includes(q)
    );
  }, [agents, mentionQuery]);

  const selectAgent = useCallback((agent: Agent) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeCursor = value.slice(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex >= 0) {
      const newValue = value.slice(0, atIndex) + `@${agent.name} ` + value.slice(cursorPos);
      onChange(newValue);
    }
    setShowMentions(false);
    onAgentMention?.(agent);
    inputRef.current?.focus();
  }, [value, onChange, onAgentMention]);

  const commands: SlashCommand[] = [
    { id: 'clear', name: 'clear', description: 'Clear the current conversation', action: () => { onChange(''); setShowCommands(false); } },
    { id: 'export', name: 'export', description: 'Export conversation as markdown', action: () => { setShowCommands(false); } },
    { id: 'template', name: 'template', description: 'Save current input as a template', action: () => { setShowCommands(false); } },
    { id: 'workflow', name: 'run-workflow', description: 'Run a workflow by name', action: () => { setShowCommands(false); } },
  ];

  const selectCommand = useCallback((cmd: SlashCommand) => {
    cmd.action();
    setShowCommands(false);
    inputRef.current?.focus();
  }, []);

  const handleTranscription = useCallback((text: string) => {
    const newValue = value ? value + ' ' + text : text;
    onChange(newValue);
    onVoiceTranscription?.(text);
  }, [value, onChange, onVoiceTranscription]);

  return (
    <div className="orch-card" style={{ padding: 14, position: 'relative' }}>
      {/* Mention popover */}
      {showMentions && getFilteredAgents().length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 14, right: 14,
          maxHeight: 200, overflow: 'auto', background: 'var(--bg-3)',
          border: '1px solid var(--border-c)', borderRadius: 8,
          boxShadow: 'var(--shadow-lg)', zIndex: 30, marginBottom: 4,
        }}>
          {getFilteredAgents().map((agent, i) => (
            <div
              key={agent.id}
              className="orch-row"
              style={{
                cursor: 'pointer', padding: '8px 12px',
                background: i === mentionIndex ? 'var(--bg-4)' : 'transparent',
              }}
              onMouseEnter={() => setMentionIndex(i)}
              onClick={() => selectAgent(agent)}
            >
              <div className="orch-row-icon">
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${agent.colorA}, ${agent.colorB})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'white',
                }}>
                  {agent.avatar}
                </div>
              </div>
              <div className="orch-row-main">
                <div className="orch-row-title" style={{ fontSize: 13 }}>{agent.name}</div>
                <div className="orch-row-sub" style={{ fontSize: 11 }}>{agent.role} &middot; {agent.model}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Command popover */}
      {showCommands && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 14, right: 14,
          maxHeight: 200, overflow: 'auto', background: 'var(--bg-3)',
          border: '1px solid var(--border-c)', borderRadius: 8,
          boxShadow: 'var(--shadow-lg)', zIndex: 30, marginBottom: 4,
        }}>
          {commands.map((cmd, i) => (
            <div
              key={cmd.id}
              style={{
                cursor: 'pointer', padding: '8px 12px',
                background: i === mentionIndex ? 'var(--bg-4)' : 'transparent',
              }}
              onMouseEnter={() => setMentionIndex(i)}
              onClick={() => selectCommand(cmd)}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>/{cmd.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{cmd.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            resize: 'none',
            borderRadius: 8,
            border: '1px solid var(--border-c)',
            background: 'var(--bg-2)',
            padding: '8px 12px',
            fontSize: 13.5,
            color: 'var(--text-1)',
            outline: 'none',
            minHeight: 40,
            maxHeight: 200,
            lineHeight: 1.5,
          }}
          rows={1}
          disabled={disabled || isGenerating}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {onVoiceTranscription && (
            <VoiceInput
              onTranscription={handleTranscription}
              disabled={disabled || isGenerating}
              sttModelId={sttModelId}
            />
          )}
          <button
            className="orch-btn primary"
            style={{ height: 40, minWidth: 40 }}
            onClick={onSubmit}
            disabled={!value.trim() || isGenerating || disabled}
          >
            {isGenerating ? <Square size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 8, fontSize: 12, color: 'var(--text-2)',
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className="orch-btn xs ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload size={12} />Attach
          </button>
          {agents.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              @mention an agent to invoke
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Enter to send &middot; Shift+Enter for newline
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.pdf,.csv,.json,.js,.ts,.py,.jsx,.tsx"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => onFileUpload?.(e.target.files!)}
      />
    </div>
  );
}