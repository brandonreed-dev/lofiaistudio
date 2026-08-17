import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useAppStore } from '@/stores';
import { DEFAULT_TEXT_PARAMS } from '@lofiaistudio/shared';
import type { TextGenerationParams } from '@lofiaistudio/shared';

export type ChatParticipantKind = 'agent' | 'persona';

export interface ChatParticipant {
  kind: ChatParticipantKind;
  id: string;
  /** Base agent id (owns skillIds); same as id when kind === agent */
  agentId: string;
  name: string;
  role: string;
  avatar: string;
  avatarImageUrl?: string;
  colorA: string;
  colorB: string;
  model?: string;
  systemPrompt?: string;
  greeting?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBoxProps {
  isOpen: boolean;
  participant: ChatParticipant | null;
  params?: TextGenerationParams;
  onClose: () => void;
}

export function ChatBox({ isOpen, participant, params = DEFAULT_TEXT_PARAMS, onClose }: ChatBoxProps) {
  const { setActiveView } = useAppStore();
  const [messagesByParticipant, setMessagesByParticipant] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const participantKey = participant ? `${participant.kind}:${participant.id}` : null;
  const messages = useMemo(
    () => (participantKey ? messagesByParticipant[participantKey] ?? [] : []),
    [messagesByParticipant, participantKey]
  );

  useEffect(() => {
    if (!participant || !participantKey) return;
    setMessagesByParticipant((current) => {
      if (current[participantKey]?.length) return current;
      return {
        ...current,
        [participantKey]: [
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: participant.greeting ?? `Hi, I am ${participant.name}. How can I help?`,
          },
        ],
      };
    });
    setError(null);
    setStreamingContent('');
  }, [participant, participantKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  if (!isOpen) return null;

  const send = () => {
    if (!participant || !participantKey || !draft.trim() || isGenerating) return;

    if (!participant.model) {
      setError(`${participant.name} does not have a text model configured yet.`);
      return;
    }

    const content = draft.trim();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };
    const outboundMessages = [...messages, userMessage]
      .filter((message) => message.content.trim())
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setDraft('');
    setError(null);
    setStreamingContent('');
    setIsGenerating(true);
    setMessagesByParticipant((current) => ({
      ...current,
      [participantKey]: [...(current[participantKey] ?? []), userMessage, assistantMessage],
    }));

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    let completed = false;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'chat',
          payload: {
            modelId: participant.model,
            agentId: participant.agentId,
            messages: outboundMessages,
            params,
            systemPrompt: participant.systemPrompt,
            requestId: assistantMessage.id,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'token') {
        setStreamingContent((current) => current + data.token);
        return;
      }

      if (data.type === 'complete') {
        completed = true;
        setMessagesByParticipant((current) => ({
          ...current,
          [participantKey]: (current[participantKey] ?? []).map((message) =>
            message.id === assistantMessage.id ? { ...message, content: String(data.content ?? '') } : message
          ),
        }));
        setStreamingContent('');
        setIsGenerating(false);
        ws.close();
        return;
      }

      if (data.type === 'error') {
        completed = true;
        const message = String(data.error ?? 'Chat request failed');
        setError(message);
        setMessagesByParticipant((current) => ({
          ...current,
          [participantKey]: (current[participantKey] ?? []).filter((entry) => entry.id !== assistantMessage.id),
        }));
        setStreamingContent('');
        setIsGenerating(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      completed = true;
      setError('Unable to connect to the local chat runtime.');
      setMessagesByParticipant((current) => ({
        ...current,
        [participantKey]: (current[participantKey] ?? []).filter((entry) => entry.id !== assistantMessage.id),
      }));
      setStreamingContent('');
      setIsGenerating(false);
    };

    ws.onclose = () => {
      if (!completed) {
        setIsGenerating(false);
        setStreamingContent('');
      }
    };
  };

  return (
    <div className="orch-chat-panel open">
      <div className="orch-chat-head">
        {participant ? (
          <div className="orch-chat-person">
            {participant.avatarImageUrl ? (
              <img className="orch-chat-avatar" src={participant.avatarImageUrl} alt="" />
            ) : (
              <div
                className="orch-chat-avatar"
                style={{ background: `linear-gradient(135deg, ${participant.colorA}, ${participant.colorB})` }}
              >
                {participant.avatar}
              </div>
            )}
            <div className="orch-chat-meta">
              <strong>{participant.name}</strong>
              <span>{participant.role}</span>
            </div>
          </div>
        ) : (
          <div className="orch-chat-meta">
            <strong>Chat</strong>
            <span>No participant selected</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="orch-icon-btn"
            title="Open in Text Panel"
            onClick={() => {
              setActiveView('text');
              onClose();
            }}
          >
            <MessageSquare size={16} />
          </button>
          <button className="orch-icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
      </div>

      <div className="orch-chat-body">
        {messages.map((message) => (
          <div className={`orch-chat-msg ${message.role === 'user' ? 'you' : 'them'}`} key={message.id}>
            {message.content || (message.role === 'assistant' && isGenerating ? streamingContent || '...' : '')}
          </div>
        ))}
        {error && <div className="orch-chat-error">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

        <div className="orch-chat-input">
        {/* <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, padding: '0 2px' }}>
          Agent skills run via the model&apos;s tool API (Ollama). Use a tool-capable model for real Reddit/API results.
        </div> */}
        <textarea
          value={draft}
          disabled={!participant || isGenerating}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={participant ? `Message ${participant.name}...` : 'No chat participant selected'}
        />
        <button className="orch-btn primary" disabled={!draft.trim() || !participant || isGenerating} onClick={send}>
          {isGenerating ? 'Sending' : 'Send'}
        </button>
      </div>
    </div>
  );
}
