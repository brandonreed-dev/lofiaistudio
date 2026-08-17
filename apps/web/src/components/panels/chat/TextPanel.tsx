import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, useModelStore, useAppStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import { Settings, Download, FileText, MessageSquare, Plus, Users, Search } from 'lucide-react';
import type { Agent, ChatMessage as ChatMessageType } from '@lofiaistudio/shared';
import { ChatMessageComponent } from '../../ChatMessage.js';
import { ChatInput } from '../../ChatInput.js';
import { GroupChatPanel } from './GroupChatPanel.js';
import { VoiceInput } from '../../VoiceInput.js';
import { VoiceOutput } from '../../VoiceOutput.js';
import { ConversationSearch } from './ConversationSearch.js';
import { ChatFolderManager } from './ChatFolderManager.js';

type Tab = 'chat' | 'group' | 'history';

export function TextPanel() {
  const {
    sessions,
    currentSessionId,
    createSession,
    setCurrentSession,
    addMessage,
    updateLastMessage,
    systemPrompt,
    setSystemPrompt,
    parameters,
    isGenerating,
    setIsGenerating,
    streamingContent,
    appendStreamingContent,
    clearStreamingContent,
    memory,
    setMemory,
    sttModel,
    setSttModel,
    ttsModel,
    setTtsModel,
    addReaction,
    removeReaction,
    editMessage,
  } = useChatStore();

  const { selectedModel } = useModelStore();
  const { executionMode } = useAppStore();
  const { agents, loadCollection } = useOrchestrationStore();

  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [showParams, setShowParams] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [contextDocs, setContextDocs] = useState<{ id: string; name: string; content: string; type: 'txt' | 'md' | 'pdf' }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string; variables: string[] }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Load agents for @mentions
  useEffect(() => {
    void loadCollection('agents');
  }, [loadCollection]);

  // Create a session if none exists
  useEffect(() => {
    if (!currentSessionId) {
      createSession();
    }
  }, [currentSessionId, createSession]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, streamingContent]);

  // Cmd/Ctrl+K shortcut to open search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleSearchNavigate = (sessionId: string, _messageId: string) => {
    setCurrentSession(sessionId);
    setTab('chat');
    setShowSearch(false);
  };
  
  // Hydrate chat sessions from server on mount (Phase 0: Persistent Chat)
  useEffect(() => {
    const store = useChatStore.getState();
    if (!store.serverLoaded) {
      store.hydrateFromServer();
    }
  }, []);
  
  // Load templates from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lofi-ai-studio-templates');
    if (saved) {
      setTemplates(JSON.parse(saved));
    }
  }, []);

  const messages = currentSessionId ? sessions[currentSessionId] || [] : [];

  // Extract variables from template content (e.g., {{variable}})
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  // Handle file upload for context documents
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'txt' || extension === 'md') {
        const content = await file.text();
        setContextDocs(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          content,
          type: extension as 'txt' | 'md',
        }]);
      } else if (extension === 'pdf') {
        setContextDocs(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          content: `[PDF file: ${file.name} - Content extraction requires server-side processing]`,
          type: 'pdf',
        }]);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove context document
  const removeContextDoc = (id: string) => {
    setContextDocs(prev => prev.filter(doc => doc.id !== id));
  };

  // Build context string from documents
  const buildContextString = (): string => {
    if (contextDocs.length === 0) return '';
    const contextParts = contextDocs.map(doc =>
      `--- Context from ${doc.name} ---\n${doc.content}\n`
    );
    return '\n' + contextParts.join('\n') + '--- End Context ---\n';
  };

  // Save current input as template
  const saveAsTemplate = () => {
    if (!input.trim()) return;
    const template = {
      id: crypto.randomUUID(),
      name: templateName || `Template ${templates.length + 1}`,
      content: input,
      variables: extractVariables(input),
    };
    const newTemplates = [...templates, template];
    setTemplates(newTemplates);
    localStorage.setItem('lofi-ai-studio-templates', JSON.stringify(newTemplates));
    setShowSaveTemplate(false);
    setTemplateName('');
  };

  // Apply template
  const applyTemplate = (template: { id: string; name: string; content: string; variables: string[] }) => {
    setInput(template.content);
    setShowTemplates(false);
  };

  // Delete template
  const deleteTemplate = (id: string) => {
    const newTemplates = templates.filter(t => t.id !== id);
    setTemplates(newTemplates);
    localStorage.setItem('lofi-ai-studio-templates', JSON.stringify(newTemplates));
  };

  // Copy output to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Download as file
  const downloadAsFile = (content: string, filename: string, type: 'txt' | 'md') => {
    const blob = new Blob([content], { type: type === 'md' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export conversation
  const exportConversation = (format: 'txt' | 'md') => {
    const contextStr = buildContextString();
    const systemStr = systemPrompt ? `System: ${systemPrompt}\n\n` : '';
    const contextHeader = contextDocs.length > 0
      ? `Context Documents: ${contextDocs.map(d => d.name).join(', ')}\n\n`
      : '';
    const messagesStr = messages.map(m => {
      const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
      return `${role}: ${m.content}`;
    }).join('\n\n');
    const exportContent = `${contextHeader}${systemStr}${messagesStr}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadAsFile(exportContent, `conversation-${timestamp}.${format}`, format);
  };

  // Build memory context from config
  const buildMemoryContext = (): string => {
    if (!memory.enabled) return '';
    if (memory.mode === 'window') {
      // Only include last N messages
      return '';
    }
    // For summary/hybrid mode, memory is injected via system prompt
    return '';
  };

  // Handle @mention agent selection
  const handleAgentMention = useCallback((agent: Agent) => {
    // When user @mentions an agent, we'll include the agentId in the chat request
    // The UI already handles inserting @AgentName into input
  }, []);

  // Handle reply to message
  const handleReply = useCallback((messageId: string) => {
    setReplyToId(messageId);
    inputRef.current?.focus();
  }, []);

  // Handle edit message
  const handleEdit = useCallback((messageId: string, newContent: string) => {
    if (currentSessionId) {
      editMessage(currentSessionId, messageId, newContent);
      // Re-send the edited message by re-processing through WebSocket
      // Set the input to the edited content and trigger a new submission
      setInput(newContent);
      // Focus the input so the user can review and re-send
      inputRef.current?.focus();
    }
  }, [currentSessionId, editMessage]);

  // Handle reaction
  const handleReact = useCallback((messageId: string, emoji: string) => {
    if (currentSessionId) {
      const message = messages.find(m => m.id === messageId);
      const hasReacted = message?.reactions?.[emoji]?.includes('self');
      if (hasReacted) {
        removeReaction(currentSessionId, messageId, emoji);
      } else {
        addReaction(currentSessionId, messageId, emoji);
      }
    }
  }, [currentSessionId, messages, addReaction, removeReaction]);

  // Handle delete message
  const handleDelete = useCallback((messageId: string) => {
    if (!currentSessionId) return;
    const updatedMessages = messages.filter(m => m.id !== messageId);
    // We need to update the store directly
    const { sessions } = useChatStore.getState();
    useChatStore.setState({
      sessions: { ...sessions, [currentSessionId]: updatedMessages },
    });
  }, [currentSessionId, messages]);

  // Handle voice transcription
  const handleVoiceTranscription = useCallback((text: string) => {
    setInput(prev => prev ? prev + ' ' + text : text);
  }, []);

  // Handle resubmit for edited messages
  const handleResubmit = (messageId: string, content: string) => {
    // This will be called after editing to re-generate the AI response
    // For now, it's a placeholder - the edited message will need to be reprocessed
  };

  const handleSubmit = async () => {
    if (!input.trim() || isGenerating || !selectedModel.text || !currentSessionId) return;

    const contextStr = buildContextString();
    const memoryStr = buildMemoryContext();
    const fullPrompt = contextStr + (memoryStr ? memoryStr + '\n' : '') + input;

    // Check for @mentions in the input
    const mentionedAgent = agents.find(a => input.includes(`@${a.name}`));

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      replyToId: replyToId || undefined,
    };

    addMessage(currentSessionId, userMessage);
    setInput('');
    setReplyToId(null);
    setIsGenerating(true);
    clearStreamingContent();

    const assistantMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      agentId: mentionedAgent?.id,
      agentName: mentionedAgent?.name,
      agentAvatarUrl: mentionedAgent?.avatarImageUrl,
      agentColor: mentionedAgent ? `linear-gradient(135deg, ${mentionedAgent.colorA}, ${mentionedAgent.colorB})` : undefined,
    };
    addMessage(currentSessionId, assistantMessage);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

      ws.onopen = () => {
        // Prepare messages with memory context
        let chatMessages = [...messages, { ...userMessage, content: fullPrompt }];
        
        // Apply memory window if enabled
        if (memory.enabled && memory.mode === 'window' && memory.windowSize > 0) {
          chatMessages = chatMessages.slice(-memory.windowSize);
        }

        ws.send(JSON.stringify({
          type: 'chat',
          payload: {
            modelId: selectedModel.text,
            agentId: mentionedAgent?.id || undefined,
            messages: chatMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            params: {
              ...parameters,
              ...(memory.enabled ? { memory: { enabled: true, mode: memory.mode, windowSize: memory.windowSize, summaryFrequency: memory.summaryFrequency } } : {}),
            },
            systemPrompt: systemPrompt || (memory.enabled ? `[Memory: ${memory.mode} mode, window: ${memory.windowSize}]` : undefined),
            requestId: assistantMessage.id,
          },
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
          appendStreamingContent(data.token);
        } else if (data.type === 'complete') {
          updateLastMessage(currentSessionId!, data.content);
          setIsGenerating(false);
          clearStreamingContent();
          ws.close();
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.error);
          setIsGenerating(false);
          clearStreamingContent();
          ws.close();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsGenerating(false);
        clearStreamingContent();
      };

    } catch (error) {
      console.error('Failed to send message:', error);
      setIsGenerating(false);
      clearStreamingContent();
    }
  };

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [showFolderManager, setShowFolderManager] = useState(false);

  const sessionEntries = Object.entries(sessions);
  const sessionCount = sessionEntries.length;

  const handleNewChat = useCallback(() => {
    createSession();
    setTab('chat');
  }, [createSession]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSession(sessionId);
    setTab('chat');
  }, [setCurrentSession]);

  const handleStartRename = useCallback((sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId);
    setEditSessionName(currentName);
  }, []);

  const handleSaveRename = useCallback(async (sessionId: string) => {
    if (!editSessionName.trim()) return;
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editSessionName.trim() }),
      });
      setCurrentSession(sessionId); // re-select to refresh
    } catch { /* ignore */ }
    setEditingSessionId(null);
    setEditSessionName('');
  }, [editSessionName]);

  const handleBranchSession = useCallback(async (sessionId: string) => {
    const sessionMessages = sessions[sessionId] || [];
    if (sessionMessages.length === 0) return;
    const branchId = crypto.randomUUID();
    const branchRoot = sessionId;
    await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: branchId,
        name: `Branch of ${sessionId.slice(0, 8)}`,
        modelId: '',
        branchParentId: sessionId,
        branchRootId: branchRoot,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
    for (const m of sessionMessages) {
      await fetch(`/api/chat/sessions/${branchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...m,
          id: crypto.randomUUID(),
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        }),
      });
    }
    setCurrentSession(branchId);
    setTab('chat');
  }, [sessions]);

  const refreshHistory = useCallback(() => {
    useChatStore.getState().hydrateFromServer();
  }, []);

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Text</h1>
          <p className="orch-view-subtitle">
            AI chat platform with voice, memory, agent integration, and multi-agent group conversations.
          </p>
        </div>
        <div className="orch-view-actions">
          {tab === 'chat' && currentSessionId && (
            <>
              <button className="orch-btn" onClick={() => setShowSearch(true)} title="Search (Cmd+K)">
                <Search size={14} />
              </button>
              <button className="orch-btn primary" onClick={handleNewChat} title="New Chat">
                <Plus size={14} />
              </button>
            </>
          )}
          {tab === 'history' && (
            <button className="orch-btn primary" onClick={handleNewChat}>
              <Plus size={14} />New Chat
            </button>
          )}
          {tab === 'chat' && currentSessionId && (
            <>
              <button className="orch-btn" onClick={() => setShowTemplates(!showTemplates)}>
                <FileText size={14} />Templates
              </button>
              {messages.length > 0 && (
                <button className="orch-btn" onClick={() => exportConversation('md')}>
                  <Download size={14} />Export
                </button>
              )}
              <button className="orch-btn" onClick={() => setShowParams(!showParams)}>
                <Settings size={14} />Parameters
              </button>
            </>
          )}
        </div>
      </div>

      <div className="orch-subtabs">
        <SubTab active={tab === 'chat'} onClick={() => setTab('chat')}>
          <MessageSquare size={13} />Chat
        </SubTab>
        <SubTab active={tab === 'group'} onClick={() => setTab('group')}>
          <Users size={13} />Group Chat
        </SubTab>
        <SubTab active={tab === 'history'} onClick={() => setTab('history')}>
          History <span className="count">{sessionCount}</span>
        </SubTab>
      </div>

      {tab === 'chat' && (
        <div className="orch-grid" style={{ gridTemplateColumns: showParams ? '1fr 280px' : '1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Messages */}
            <div className="orch-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="orch-card-header">
                <div className="orch-card-title">
                  <MessageSquare size={14} />
                  {currentSessionId ? `Session ${currentSessionId.slice(0, 8)}` : 'New Chat'}
                </div>
                {currentSessionId && (
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                    {memory.enabled && <span style={{ marginLeft: 6, color: 'var(--accent)' }}>· Memory: {memory.mode}</span>}
                  </span>
                )}
              </div>
              <div className="orch-chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Start a conversation</p>
                    <p style={{ fontSize: 13 }}>
                      Send a message to begin chatting with {selectedModel.text || 'a model'}
                    </p>
                  </div>
                )}

                {messages.map((message, idx) => (
                  <ChatMessageComponent
                    key={message.id}
                    message={message}
                    isGenerating={isGenerating}
                    streamingContent={streamingContent}
                    isLast={idx === messages.length - 1}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReact={handleReact}
                    ttsModelId={ttsModel}
                  />
                ))}

                {replyToId && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', background: 'var(--bg-3)', borderRadius: 8,
                    fontSize: 12, color: 'var(--text-2)',
                  }}>
                    <span>Replying to message...</span>
                    <button
                      className="orch-icon-btn"
                      style={{ width: 18, height: 18, marginLeft: 'auto' }}
                      onClick={() => setReplyToId(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Context Documents Display */}
            {contextDocs.length > 0 && (
              <div className="orch-card" style={{ padding: '8px 12px' }}>
                <div className="orch-context-chips">
                  {contextDocs.map(doc => (
                    <div key={doc.id} className="orch-context-chip">
                      <FileText size={12} />
                      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                      <button className="orch-icon-btn" style={{ width: 16, height: 16 }} onClick={() => removeContextDoc(doc.id)}>
                        <span style={{ fontSize: 10 }}>✕</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              onFileUpload={(files) => {
                const event = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFileUpload(event);
              }}
              onVoiceTranscription={handleVoiceTranscription}
              isGenerating={isGenerating}
              placeholder="Type a message... (@ to mention an agent)"
              agents={agents}
              onAgentMention={handleAgentMention}
              sttModelId={sttModel}
            />
          </div>

          {/* Parameters Panel */}
          {showParams && (
            <div className="orch-card orch-params-panel">
              <div className="orch-card-header">
                <div className="orch-card-title">Parameters</div>
              </div>
              <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Model Selection */}
                <Field label="Model">
                  <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 0' }}>
                    {selectedModel.text || 'No model selected'}
                  </div>
                </Field>

                <Field label="Temperature">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={parameters.temperature || 0.7}
                      onChange={(e) => useChatStore.getState().setParameters({ temperature: parseFloat(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 12, minWidth: 26 }}>{(parameters.temperature || 0.7).toFixed(1)}</span>
                  </div>
                </Field>

                <Field label="Max Tokens">
                  <input
                    className="orch-input"
                    type="number"
                    value={parameters.maxTokens || 2048}
                    onChange={(e) => useChatStore.getState().setParameters({ maxTokens: parseInt(e.target.value) || 2048 })}
                  />
                </Field>

                <Field label="Top P">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={parameters.topP || 0.9}
                      onChange={(e) => useChatStore.getState().setParameters({ topP: parseFloat(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 12, minWidth: 26 }}>{(parameters.topP || 0.9).toFixed(2)}</span>
                  </div>
                </Field>

                <Field label="System Prompt">
                  <textarea
                    className="orch-textarea"
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Optional system prompt..."
                  />
                </Field>

                {/* Voice Model Selectors */}
                <Field label="STT Model (Voice Input)">
                  <select
                    className="orch-select"
                    value={sttModel || ''}
                    onChange={(e) => setSttModel(e.target.value || null)}
                  >
                    <option value="">Default STT Model</option>
                    {useModelStore.getState().models.audio
                      .filter(m => m.type === 'stt')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                  </select>
                </Field>

                <Field label="TTS Model (Voice Output)">
                  <select
                    className="orch-select"
                    value={ttsModel || ''}
                    onChange={(e) => setTtsModel(e.target.value || null)}
                  >
                    <option value="">Default TTS Model</option>
                    {useModelStore.getState().models.audio
                      .filter(m => m.type === 'tts')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                  </select>
                </Field>

                {/* Summarization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Session Summary</span>
                    <button className="orch-btn xs" onClick={async () => {
                      if (!currentSessionId || summarizing) return;
                      setSummarizing(true);
                      setSummary(null);
                      try {
                        const res = await fetch(`/api/chat/sessions/${currentSessionId}/summarize`, { method: 'POST' });
                        const data = await res.json();
                        if (data.success) setSummary(data.data.summary);
                      } catch { /* ignore */ }
                      setSummarizing(false);
                    }}>
                      {summarizing ? 'Summarizing...' : 'Summarize'}
                    </button>
                  </div>
                  {summary && (
                    <div style={{
                      fontSize: 11, color: 'var(--text-2)', background: 'var(--bg-2)',
                      border: '1px solid var(--border-c)', borderRadius: 6, padding: '6px 8px',
                      lineHeight: 1.4,
                    }}>{summary}</div>
                  )}
                </div>
                <div className="orch-memory-section">
                  <div className="orch-memory-section-title">Chat Memory</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Enable Memory</span>
                    <button
                      className={`orch-toggle${memory.enabled ? ' on' : ''}`}
                      onClick={() => setMemory({ enabled: !memory.enabled })}
                    />
                  </div>

                  {memory.enabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Field label="Memory Mode">
                        <select
                          className="orch-select"
                          value={memory.mode}
                          onChange={(e) => setMemory({ mode: e.target.value as 'summary' | 'window' | 'hybrid' })}
                        >
                          <option value="window">Window (last N messages)</option>
                          <option value="summary">Summary (compressed)</option>
                          <option value="hybrid">Hybrid (summary + window)</option>
                        </select>
                      </Field>

                      <Field label="Window Size">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="range"
                            min="10"
                            max="200"
                            step="10"
                            value={memory.windowSize}
                            onChange={(e) => setMemory({ windowSize: parseInt(e.target.value) })}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontSize: 12, minWidth: 30 }}>{memory.windowSize}</span>
                        </div>
                      </Field>

                      {memory.mode !== 'window' && (
                        <Field label="Summary Frequency">
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="range"
                              min="5"
                              max="100"
                              step="5"
                              value={memory.summaryFrequency}
                              onChange={(e) => setMemory({ summaryFrequency: parseInt(e.target.value) })}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: 12, minWidth: 30 }}>Every {memory.summaryFrequency}</span>
                          </div>
                        </Field>
                      )}

                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        {memory.mode === 'window' && `Only the last ${memory.windowSize} messages are included in context.`}
                        {memory.mode === 'summary' && `Messages are periodically summarized and injected into the system prompt.`}
                        {memory.mode === 'hybrid' && `Both a summary and the last ${memory.windowSize} messages are used.`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'group' && (
        <GroupChatPanel />
      )}

      {tab === 'history' && (
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">
              <MessageSquare size={14} />Chat History
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="orch-btn xs" onClick={() => setShowFolderManager(prev => !prev)}>
                {showFolderManager ? 'Hide Folders' : 'Folders'}
              </button>
              <button className="orch-btn xs" onClick={async () => {
                const { sessions } = useChatStore.getState();
                const blob = new Blob([JSON.stringify({ sessions }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `conversations-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                Export JSON
              </button>
              <label className="orch-btn xs" style={{ cursor: 'pointer' }}>
                Import JSON
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  try {
                    const data = JSON.parse(text);
                    if (data.sessions && Array.isArray(data.sessions)) {
                      for (const s of data.sessions) {
                        await fetch('/api/chat/sessions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: s.id, name: s.name, modelId: s.modelId, createdAt: s.createdAt, updatedAt: s.updatedAt }),
                        });
                      }
                      useChatStore.getState().hydrateFromServer();
                    }
                  } catch { alert('Invalid JSON file'); }
                  e.target.value = '';
                }} />
              </label>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {sessionCount} session{sessionCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {showFolderManager && (
            <ChatFolderManager
              isOpen={showFolderManager}
              onClose={() => setShowFolderManager(false)}
              onRefresh={refreshHistory}
            />
          )}
          <div className="orch-history-card">
            {sessionEntries.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
                No chat sessions yet. Start a new chat to begin.
              </div>
            )}
            {sessionEntries.map(([sessionId, sessionMessages]) => {
              const firstMsg = sessionMessages[0];
              const preview = firstMsg
                ? firstMsg.content.slice(0, 80) + (firstMsg.content.length > 80 ? '...' : '')
                : 'Empty session';
              const msgCount = sessionMessages.length;
              const isCurrent = sessionId === currentSessionId;
              const lastMsg = sessionMessages[sessionMessages.length - 1];
              const lastTime = lastMsg?.timestamp;
              const timeStr = lastTime ? new Date(lastTime).toLocaleDateString() : '';
              const isEditing = editingSessionId === sessionId;

              return (
                <div
                  className={`orch-row${isCurrent ? ' active' : ''}`}
                  key={sessionId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isEditing) return;
                    // Open branch view if this session has a branch parent
                    const current = sessions[sessionId];
                    const branchOf = (current as any)?.branchParentId;
                    if (branchOf && branchOf !== sessionId) {
                      // Open root branch instead for conversation threading
                      setCurrentSession(branchOf);
                    } else {
                      setCurrentSession(sessionId);
                    }
                    setTab('chat');
                  }}
                >
                  <div className="orch-row-icon">
                    <MessageSquare size={14} />
                  </div>
                  <div className="orch-row-main">
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%' }}
                           onClick={(e) => e.stopPropagation()}>
                        <input
                          className="orch-input"
                          value={editSessionName}
                          onChange={(e) => setEditSessionName(e.target.value)}
                          onBlur={() => handleSaveRename(sessionId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(sessionId);
                            if (e.key === 'Escape') { setEditingSessionId(null); setEditSessionName(''); }
                          }}
                          autoFocus
                          style={{ fontSize: 12, padding: '3px 6px', flex: 1 }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="orch-row-title">
                          {sessionId.slice(0, 8)}
                          {isCurrent && <span className="orch-chip green" style={{ marginLeft: 6 }}>current</span>}
                        </div>
                        <div className="orch-row-sub">
                          {msgCount} message{msgCount !== 1 ? 's' : ''}
                          {timeStr && <span> · {timeStr}</span>}
                          {preview && <span> · {preview}</span>}
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        className="orch-btn xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(sessionId, sessionId.slice(0, 8));
                        }}
                        title="Rename"
                      >
                        Rename
                    </button>
                      {msgCount > 0 && (
                        <button
                          className="orch-btn xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBranchSession(sessionId);
                          }}
                          title="Branch conversation"
                        >
                          Branch
                        </button>
                      )}
                      <button
                        className="orch-btn xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSession(sessionId);
                        }}
                      >
                        <MessageSquare size={12} />Resume
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div className="orch-card" style={{ position: 'absolute', left: 16, bottom: 180, width: 300, zIndex: 20, maxHeight: 360, overflow: 'auto' }}>
          <div className="orch-card-header">
            <div className="orch-card-title">Prompt Templates</div>
            <button
              className="orch-btn xs"
              onClick={() => setShowSaveTemplate(true)}
              disabled={!input.trim()}
            >
              <Plus size={12} />Save
            </button>
          </div>
          <div style={{ padding: 8 }}>
            {templates.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                No templates saved yet
              </div>
            ) : (
              templates.map(template => (
                <div
                  key={template.id}
                  className="orch-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => applyTemplate(template)}
                >
                  <div className="orch-row-main">
                    <div className="orch-row-title" style={{ fontSize: 13 }}>{template.name}</div>
                    <div className="orch-row-sub" style={{ fontSize: 11, lineHeight: 1.3 }}>
                      {template.content.slice(0, 60)}{template.content.length > 60 ? '...' : ''}
                    </div>
                    {template.variables.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {template.variables.map(v => (
                          <span key={v} style={{ fontSize: 10, background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>
                            {'{{'}{v}{'}}'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="orch-icon-btn"
                    style={{ width: 22, height: 22, fontSize: 12, color: 'var(--text-3)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTemplate(template.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Conversation Search Overlay */}
      {showSearch && (
        <ConversationSearch
          onClose={() => setShowSearch(false)}
          onNavigate={handleSearchNavigate}
        />
      )}

      {/* Save Template Dialog */}
      {showSaveTemplate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 320 }}>
            <div className="orch-card-header">
              <div className="orch-card-title">Save as Template</div>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="orch-input"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name..."
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="orch-btn" onClick={() => setShowSaveTemplate(false)}>Cancel</button>
                <button className="orch-btn primary" onClick={saveAsTemplate}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button className={`orch-subtab${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{label}</label>
      {children}
    </div>
  );
}