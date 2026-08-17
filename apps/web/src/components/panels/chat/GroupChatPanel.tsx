import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGroupChatStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import { Plus, Trash2, Settings, MessageSquare, Users, Send, Square, Bot, X, Copy, Download } from 'lucide-react';
import type { GroupChatMessage, Agent } from '@lofiaistudio/shared';

function formatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function GroupChatPanel() {
  const {
    rooms,
    currentRoomId,
    createRoom,
    deleteRoom,
    setCurrentRoom,
    addAgentToRoom,
    removeAgentFromRoom,
    addMessage,
    isGenerating,
    setIsGenerating,
    streamingContents,
    appendStreamingContent,
    clearStreamingContents,
    conversationRounds,
    setConversationRounds,
    currentSpeakingAgentId,
    turnProgress,
  } = useGroupChatStore();

  const { agents, loadCollection } = useOrchestrationStore();
  const [input, setInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadCollection('agents');
  }, [loadCollection]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rooms, streamingContents]);

  const currentRoom = currentRoomId ? rooms[currentRoomId] : null;
  const roomAgents = useMemo(() => {
    if (!currentRoom) return [];
    return agents.filter(a => currentRoom.agentIds.includes(a.id));
  }, [currentRoom, agents]);

  const availableAgents = agents.filter(
    a => !currentRoom || !currentRoom.agentIds.includes(a.id)
  );

  const handleCreate = () => {
    if (!newRoomName.trim() || selectedAgentIds.length === 0) return;
    createRoom(newRoomName.trim(), newRoomDesc.trim(), selectedAgentIds);
    setNewRoomName('');
    setNewRoomDesc('');
    setSelectedAgentIds([]);
    setShowCreate(false);
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const addAgentToCurrentRoom = (agentId: string) => {
    if (currentRoomId) {
      addAgentToRoom(currentRoomId, agentId);
    }
    setShowAgentSelector(false);
  };

  const removeAgentFromCurrentRoom = (agentId: string) => {
    if (currentRoomId) {
      removeAgentFromRoom(currentRoomId, agentId);
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !currentRoomId || isGenerating) return;

    const userMessage: GroupChatMessage = {
      id: crypto.randomUUID(),
      roomId: currentRoomId,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    addMessage(currentRoomId, userMessage);
    setInput('');
    setIsGenerating(true);
    clearStreamingContents();
    
    // Reset orchestrator display state
    const store = useGroupChatStore.getState();
    store.setCurrentSpeakingAgent(null);
    store.setCurrentRound(0);
    store.setTotalRounds(0);
    store.setTurnProgress('');

    // Build agent info for the orchestrator
    const room = useGroupChatStore.getState().rooms[currentRoomId];
    if (!room) return;

    const roomAgents = agents.filter(a => room.agentIds.includes(a.id));
    const agentInfo = roomAgents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      model: a.model,
      systemPrompt: a.systemPrompt,
      colorA: a.colorA,
      colorB: a.colorB,
      avatar: a.avatar,
      avatarImageUrl: a.avatarImageUrl,
      skillIds: a.skillIds,
      workflowIds: a.workflowIds,
      capabilities: a.capabilities,
      project: a.project,
    }));

    const rounds = useGroupChatStore.getState().conversationRounds;
    const turnOrder = room.turnOrder?.length ? room.turnOrder : room.agentIds;

    const fullHistory = room.messages;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'group_chat',
        payload: {
          roomId: currentRoomId,
          messages: fullHistory,
          agents: agentInfo,
          agentOrder: turnOrder,
          rounds,
          systemPrompt: room.systemPrompt,
        },
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const store = useGroupChatStore.getState();
      const stateRoom = store.rooms[currentRoomId];
      if (!stateRoom) return;

      if (data.type === 'group_turn') {
        const { agentId, agentName, round, totalRounds, turnIndex, totalAgents, status } = data.payload;
        
        store.setCurrentSpeakingAgent(status === 'started' ? agentId : null);
        store.setCurrentRound(round);
        store.setTotalRounds(totalRounds);
        store.setTurnProgress(`Round ${round} of ${totalRounds} • ${turnIndex + 1} of ${totalAgents}`);

        // On turn started, add a placeholder message for the agent
        if (status === 'started') {
          const agent = agents.find(a => a.id === agentId);
          const placeholderMsg: GroupChatMessage = {
            id: crypto.randomUUID(),
            roomId: currentRoomId,
            role: 'assistant',
            agentId,
            agentName: agentName,
            agentColor: agent ? `linear-gradient(135deg, ${agent.colorA}, ${agent.colorB})` : undefined,
            agentAvatarUrl: agent?.avatarImageUrl,
            content: '',
            timestamp: new Date(),
          };
          store.addMessage(currentRoomId, placeholderMsg);
        }
      } else if (data.type === 'group_token') {
        const { agentId, token } = data.payload;
        // Find the last assistant message from this agent and update its content
        const messages = store.rooms[currentRoomId]?.messages || [];
        const lastAgentMsgIdx = messages.map((m, i) => 
          m.agentId === agentId && m.role === 'assistant' ? i : -1
        ).filter(i => i >= 0).pop();
        
        if (lastAgentMsgIdx !== undefined && lastAgentMsgIdx >= 0) {
          store.appendStreamingContent(agentId, token);
        }
      } else if (data.type === 'group_finished') {
        const { finalMessages } = data.payload;
        store.updateRoomFromServer(currentRoomId, finalMessages);
        store.setIsGenerating(false);
        store.clearStreamingContents();
        store.setCurrentSpeakingAgent(null);
        store.setTurnProgress('');
        ws.close();
      } else if (data.type === 'error') {
        console.error('[GroupChat] Orchestrator error:', data.error);
        store.setIsGenerating(false);
        store.clearStreamingContents();
        store.setCurrentSpeakingAgent(null);
        store.setTurnProgress('');
        ws.close();
      }
    };

    ws.onerror = (err) => {
      console.error('[GroupChat] WebSocket error:', err);
      const store = useGroupChatStore.getState();
      store.setIsGenerating(false);
      store.clearStreamingContents();
      store.setCurrentSpeakingAgent(null);
      store.setTurnProgress('');
    };

    ws.onclose = () => {
      const store = useGroupChatStore.getState();
      store.setIsGenerating(false);
      store.clearStreamingContents();
      store.setCurrentSpeakingAgent(null);
      store.setTurnProgress('');
    };
  }, [input, currentRoomId, isGenerating, agents, addMessage, setIsGenerating, clearStreamingContents, appendStreamingContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="orch-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Group Chat</h1>
          <p className="orch-view-subtitle">
            Multi-agent group conversations. Add agents to a room and they'll coordinate and share context.
          </p>
        </div>
        <div className="orch-view-actions">
          <button className="orch-btn primary" onClick={() => setShowCreate(true)} disabled={agents.length === 0}>
            <Plus />New Room
          </button>
        </div>
      </div>

      {/* Room Selector / Chat Area */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        {/* Room list sidebar */}
        <div className="orch-card" style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="orch-card-header">
            <div className="orch-card-title">
              <Users size={14} />Rooms
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{Object.keys(rooms).length}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {Object.values(rooms).length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                No group rooms yet. Create one to start a multi-agent conversation.
              </div>
            )}
            {Object.values(rooms).map(room => (
              <div
                key={room.id}
                className={`orch-row${room.id === currentRoomId ? ' active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setCurrentRoom(room.id)}
              >
                <div className="orch-row-icon">
                  <MessageSquare size={14} />
                </div>
                <div className="orch-row-main">
                  <div className="orch-row-title" style={{ fontSize: 13 }}>{room.name}</div>
                  <div className="orch-row-sub" style={{ fontSize: 11 }}>
                    {room.agentIds.length} agent{room.agentIds.length !== 1 ? 's' : ''} &middot; {room.messages.length} messages
                  </div>
                </div>
                <button
                  className="orch-icon-btn"
                  style={{ width: 20, height: 20 }}
                  onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        {currentRoom ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {/* Room header */}
            <div className="orch-card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{currentRoom.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                    {currentRoom.description || 'No description'} &middot; {currentRoom.messages.length} messages
                  </div>
                </div>
                <button className="orch-btn xs ghost" onClick={() => setShowSettings(!showSettings)}>
                  <Settings size={12} />Settings
                </button>
              </div>

              {/* Agent chips */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {roomAgents.map(agent => (
                  <div
                    key={agent.id}
                    className="orch-chip purple"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    title={`${agent.name} - ${agent.role}`}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${agent.colorA}, ${agent.colorB})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, fontWeight: 700, color: 'white',
                    }}>
                      {agent.avatar}
                    </div>
                    <span>{agent.name}</span>
                    <button
                      className="orch-icon-btn"
                      style={{ width: 14, height: 14 }}
                      onClick={() => removeAgentFromCurrentRoom(agent.id)}
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
                <button className="orch-btn xs ghost" onClick={() => setShowAgentSelector(true)}>
                  <Plus size={10} />Add Agent
                </button>
              </div>
            </div>

            {/* Orchestration Progress Bar */}
            {isGenerating && currentSpeakingAgentId && (
              <div className="orch-card" style={{
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderLeft: roomAgents.find(a => a.id === currentSpeakingAgentId) ? 
                  `3px solid ${(() => {
                    const a = roomAgents.find(ra => ra.id === currentSpeakingAgentId);
                    return a ? a.colorB : 'var(--accent)';
                  })()}` : '3px solid var(--accent)',
              }}>
                <Bot size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8, height: 8,
                      borderRadius: '50%',
                      background: (() => {
                        const a = roomAgents.find(ra => ra.id === currentSpeakingAgentId);
                        return a ? `linear-gradient(135deg, ${a.colorA}, ${a.colorB})` : 'var(--accent)';
                      })(),
                      animation: 'pulse 1.2s ease-in-out infinite',
                    }} />
                    {roomAgents.find(a => a.id === currentSpeakingAgentId)?.name || 'Agent'} is speaking...
                  </div>
                  {turnProgress && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {turnProgress}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="orch-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentRoom.messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Start a group conversation</p>
                    <p style={{ fontSize: 13 }}>
                      Send a message and all agents in the room will respond.
                    </p>
                  </div>
                )}

                {currentRoom.messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
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
                          : message.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-0)',
                        flexShrink: 0,
                      }}
                    >
                      {message.role === 'user' ? 'U' : (message.agentName?.[0] || 'A')}
                    </div>

                    {/* Message */}
                    <div style={{ maxWidth: '80%', minWidth: 0 }}>
                      {message.agentName && (
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: 'var(--accent-2)', marginBottom: 2, marginLeft: 2,
                        }}>
                          {message.agentName}
                        </div>
                      )}
                      <div
                        style={{
                          borderRadius: 10,
                          padding: '10px 14px',
                          background: message.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
                          color: 'var(--text-1)',
                          position: 'relative',
                          lineHeight: 1.5,
                          fontSize: 13.5,
                        }}
                      >
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {message.content || (message.role === 'assistant' && isGenerating ? (streamingContents[message.agentId || ''] || '...') : '')}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        marginTop: 2, fontSize: 10, color: 'var(--text-3)',
                        padding: '0 4px', height: 18,
                      }}>
                        <span>{formatTime(message.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="orch-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message to all agents..."
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
                    lineHeight: 1.5,
                  }}
                  rows={1}
                  disabled={isGenerating}
                />
                <button
                  className="orch-btn primary"
                  style={{ height: 40 }}
                  onClick={handleSend}
                  disabled={!input.trim() || isGenerating}
                >
                  {isGenerating ? <Square size={16} /> : <Send size={16} />}
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                Message will be sent to all {roomAgents.length} agent{roomAgents.length !== 1 ? 's' : ''} in the room
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
              <Users size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Select a room or create one</p>
              <p style={{ fontSize: 13 }}>
                Group chats let multiple agents collaborate on tasks together.
              </p>
              <button className="orch-btn primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
                <Plus />Create Room
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Room Dialog */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 420, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="orch-card-header">
              <div className="orch-card-title">Create Group Room</div>
              <button className="orch-icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="orch-input"
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name..."
              />
              <input
                className="orch-input"
                type="text"
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="Description (optional)..."
              />
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6, display: 'block' }}>
                  Select Agents ({selectedAgentIds.length} selected)
                </label>
                <div style={{ maxHeight: 240, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {agents.length === 0 && (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                      No agents available. Create agents first in the Agents panel.
                    </div>
                  )}
                  {agents.map(agent => (
                    <div
                      key={agent.id}
                      className="orch-row"
                      style={{
                        cursor: 'pointer',
                        background: selectedAgentIds.includes(agent.id) ? 'var(--bg-4)' : undefined,
                      }}
                      onClick={() => toggleAgentSelection(agent.id)}
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
                        <div className="orch-row-sub" style={{ fontSize: 11 }}>{agent.role}</div>
                      </div>
                      {selectedAgentIds.includes(agent.id) && (
                        <div style={{ color: 'var(--accent)', fontSize: 14 }}>✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="orch-btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <button
                  className="orch-btn primary"
                  onClick={handleCreate}
                  disabled={!newRoomName.trim() || selectedAgentIds.length === 0}
                >
                  Create Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Settings Dialog */}
      {showSettings && currentRoom && roomAgents.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 380 }}>
            <div className="orch-card-header">
              <div className="orch-card-title">
                <Settings size={14} /> Room Settings
              </div>
              <button className="orch-icon-btn" onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>
            <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Conversation Rounds */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', display: 'block', marginBottom: 6 }}>
                  Conversation Rounds
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={conversationRounds}
                    onChange={(e) => setConversationRounds(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--accent)',
                    minWidth: 24, textAlign: 'center',
                  }}>
                    {conversationRounds}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  {conversationRounds === 1
                    ? 'Each agent will speak once per message.'
                    : `Each agent will speak ${conversationRounds} times per message, enabling multi-turn debate.`}
                </div>
              </div>
              
              {/* Turn Order Info */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', display: 'block', marginBottom: 4 }}>
                  Turn Order
                </label>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {roomAgents.map((a, i) => (
                    <span key={a.id}>
                      <span style={{ color: `linear-gradient(135deg, ${a.colorA}, ${a.colorB})` === 'undefined' ? 'var(--accent)' : undefined }}>
                        {i + 1}. {a.name}
                      </span>
                      {i < roomAgents.length - 1 && <span style={{ margin: '0 4px' }}>→</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Agent to Room Dialog */}
      {showAgentSelector && currentRoom && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div className="orch-card" style={{ width: 360 }}>
            <div className="orch-card-header">
              <div className="orch-card-title">Add Agent to Room</div>
              <button className="orch-icon-btn" onClick={() => setShowAgentSelector(false)}><X size={16} /></button>
            </div>
            <div className="orch-card-body" style={{ maxHeight: 320, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {availableAgents.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                  All agents are already in this room.
                </div>
              )}
              {availableAgents.map(agent => (
                <div
                  key={agent.id}
                  className="orch-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => addAgentToCurrentRoom(agent.id)}
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
                    <div className="orch-row-sub" style={{ fontSize: 11 }}>{agent.role}</div>
                  </div>
                  <button className="orch-btn xs primary"><Plus size={10} />Add</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}