import { useEffect, useMemo, useState } from 'react';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { Agent, Skill } from '@lofiaistudio/shared';
import { Bot, Cpu, Image as ImageIcon, LayoutGrid, List as ListIcon, Mic, MoreHorizontal, Play, Plus, Volume2, Star, ArrowUpDown, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useStarredIds, useItemTags, EmptyState } from '../panelPrimitives';

type Tab = 'all' | 'active' | 'idle' | 'disabled';
type SortOption = 'name' | 'runs' | 'status' | 'model';

export function AgentsPanel() {
  const { agents, skills, loadCollection, openDrawer, updateEntity, setAgentChatOpen, setSelectedAgentChatId } = useOrchestrationStore();
  const [tab, setTab] = useState<Tab>('all');
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showStarsOnly, setShowStarsOnly] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [taggingAgentId, setTaggingAgentId] = useState<string | null>(null);

  useEffect(() => {
    void loadCollection('agents');
    void loadCollection('skills');
  }, [loadCollection]);

  const { starredIds, toggle: toggleStar, isStarred } = useStarredIds('agents');
  const { addTag, removeTag, getTags } = useItemTags('agents');

  const counts = useMemo(
    () => ({
      all: agents.length,
      active: agents.filter((a) => a.status === 'active' || a.status === 'busy').length,
      idle: agents.filter((a) => a.status === 'idle').length,
      disabled: agents.filter((a) => a.status === 'disabled').length,
    }),
    [agents]
  );

  const visible = useMemo(() => {
    let list = agents;
    if (tab === 'active') list = list.filter((a) => a.status === 'active' || a.status === 'busy');
    else if (tab === 'idle') list = list.filter((a) => a.status === 'idle');
    else if (tab === 'disabled') list = list.filter((a) => a.status === 'disabled');
    if (showStarsOnly) list = list.filter((a) => isStarred(a.id));
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        (a.systemPrompt ?? '').toLowerCase().includes(q) ||
        getTags(a.id).some((t) => t.includes(q))
      );
    }
    list = list.slice().sort((a, b) => {
      switch (sortBy) {
        case 'runs': return b.runCount - a.runCount;
        case 'status': return a.status.localeCompare(b.status);
        case 'model': return a.model.localeCompare(b.model);
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [agents, tab, filter, sortBy, showStarsOnly, isStarred, getTags]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        if (visible.length > 0) {
          const first = visible[0];
          updateEntity('agents', first.id, { status: 'busy', runCount: first.runCount + 1 });
        }
      } else if (e.key === 'Escape') {
        setTaggingAgentId(null);
        setTagInput('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, updateEntity]);

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Agents</h1>
          <p className="orch-view-subtitle">
            Persistent AI workers with their own personas, skills, memory, and triggers. Each agent can have a voice, avatar, and greeting for chat interactions.
          </p>
        </div>
        <div className="orch-view-actions">
          <button className="orch-btn primary" onClick={() => openDrawer('agent')}>
            <Plus />
            Add New Agent
          </button>
        </div>
      </div>

      <div className="orch-subtabs">
        <SubTab active={tab === 'all'} onClick={() => setTab('all')}>All <span className="count">{counts.all}</span></SubTab>
        <SubTab active={tab === 'active'} onClick={() => setTab('active')}>Active <span className="count">{counts.active}</span></SubTab>
        <SubTab active={tab === 'idle'} onClick={() => setTab('idle')}>Idle <span className="count">{counts.idle}</span></SubTab>
        <SubTab active={tab === 'disabled'} onClick={() => setTab('disabled')}>Disabled <span className="count">{counts.disabled}</span></SubTab>
      </div>

      <div className="orch-filter">
        <input className="orch-input" placeholder="Filter agents..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="orch-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
          <option value="name">Name</option>
          <option value="runs">Run count</option>
          <option value="status">Status</option>
          <option value="model">Model</option>
        </select>
        <select className="orch-select">
          <option>All projects</option>
          {[...new Set(agents.map((agent) => agent.project))].map((project) => <option key={project}>{project}</option>)}
        </select>
        {agents.some((a) => isStarred(a.id)) && (
          <button
            className={`orch-btn xs ${showStarsOnly ? '' : ' ghost'}`}
            onClick={() => setShowStarsOnly(!showStarsOnly)}
          >
            <Star size={12} />Starred
          </button>
        )}
        <div className="orch-segmented" style={{ marginLeft: 'auto' }}>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><LayoutGrid size={14} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><ListIcon size={14} /></button>
        </div>
      </div>

      <div className={`orch-grid ${view === 'grid' ? 'orch-grid-3' : ''}`}>
        {visible.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            skills={skills}
            isStarred={isStarred(agent.id)}
            tags={getTags(agent.id)}
            onToggleStar={() => toggleStar(agent.id)}
            onAddTag={(tag) => addTag(agent.id, tag)}
            onRemoveTag={(tag) => removeTag(agent.id, tag)}
            onEdit={() => openDrawer('agent', agent.id)}
            onRun={() => updateEntity('agents', agent.id, { status: 'busy', runCount: agent.runCount + 1 })}
            onChat={() => {
              setSelectedAgentChatId(agent.id);
              setAgentChatOpen(true);
            }}
          />
        ))}
        {visible.length === 0 && <EmptyState title="No agents match your filters." />}
      </div>
    </div>
  );
}

function SubTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button className={`orch-subtab${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}

function AgentCard({ agent, skills, isStarred, tags, onToggleStar, onAddTag, onRemoveTag, onEdit, onRun, onChat }: {
  agent: Agent;
  skills: Skill[];
  isStarred: boolean;
  tags: string[];
  onToggleStar: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onEdit: () => void;
  onRun: () => void;
  onChat: () => void;
}) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const statusChip = agent.status === 'active' ? 'green' : agent.status === 'busy' ? 'amber' : agent.status === 'disabled' ? 'red' : '';
  const skillNames = agent.skillIds
    .map((id) => skills.find((skill) => skill.id === id)?.name ?? id)
    .slice(0, 3);

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    onAddTag(tagInput.trim());
    setTagInput('');
    setShowTagInput(false);
  };

  return (
    <div className="orch-card" style={{ cursor: 'pointer' }}>
      <div className="orch-card-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }} onClick={onEdit}>
        {agent.avatarImageUrl ? (
          <img
            src={agent.avatarImageUrl}
            alt=""
            className={`orch-avatar${agent.status === 'idle' ? ' idle' : agent.status === 'busy' ? ' busy' : ''}`}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className={`orch-avatar${agent.status === 'idle' ? ' idle' : agent.status === 'busy' ? ' busy' : ''}`} style={{ background: `linear-gradient(135deg, ${agent.colorA}, ${agent.colorB})` }}>
            {agent.avatar}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>{agent.name}</strong>
            <span className={`orch-chip ${statusChip}`}><span className={`orch-dot${agent.status === 'active' ? ' pulse' : ''}`} />{agent.status}</span>
            <button className="orch-icon-btn" style={{ width: 20, height: 20, marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); onToggleStar(); }}>
              <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 2 }}>{agent.role}</div>
          <div style={{ color: 'var(--text-1)', fontSize: 12.5, marginTop: 10, lineHeight: 1.45 }}>
            {agent.systemPrompt ?? 'No system prompt configured.'}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11.5, color: 'var(--text-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cpu size={11} /> {agent.model}</span>
            <span>{skillNames.length > 0 ? skillNames.join(', ') : 'No skills'}</span>
            <span>{agent.runCount.toLocaleString()} runs</span>
          </div>
          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <span key={tag} className="orch-chip" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {tag}
                  <button
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 10 }}
                    onClick={(e) => { e.stopPropagation(); onRemoveTag(tag); }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Skill management capabilities chips */}
          {agent.capabilities && (
            (() => {
              const activeCaps: string[] = [];
              if (agent.capabilities.skillRead) activeCaps.push('Read');
              if (agent.capabilities.skillCreate) activeCaps.push('Create');
              if (agent.capabilities.skillUpdate) activeCaps.push('Update');
              if (agent.capabilities.skillDelete) activeCaps.push('Delete');
              if (activeCaps.length === 0) return null;
              return (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 2 }}>Skills:</span>
                  {activeCaps.map((cap) => (
                    <span key={cap} className={`orch-chip ${cap === 'Delete' ? 'red' : 'purple'}`} style={{ fontSize: 10.5, padding: '1px 6px' }}>
                      {cap}
                    </span>
                  ))}
                </div>
              );
            })()
          )}
          {/* Persona features */}
          {(agent.ttsModel || agent.sttModel) && (
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--text-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              {agent.ttsModel && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Volume2 size={11} /> {agent.ttsModel}
                </span>
              )}
              {agent.sttModel && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Mic size={11} /> {agent.sttModel}
                </span>
              )}
              {agent.avatarImageUrl && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ImageIcon size={11} /> Avatar configured
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 14px', alignItems: 'center' }}>
        <button className="orch-btn xs" onClick={onChat}><Bot size={12} />Chat</button>
        <button className="orch-btn xs" onClick={onRun}><Play size={12} />Run</button>
        <button className="orch-btn xs ghost" onClick={onEdit}>Edit</button>
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button className="orch-btn xs ghost" onClick={(e) => { e.stopPropagation(); setShowTagInput(!showTagInput); }}>
            <TagIcon size={12} />
          </button>
          {showTagInput && (
            <div style={{
              position: 'absolute', bottom: '100%', right: 0, zIndex: 10,
              background: 'var(--bg-1)', border: '1px solid var(--border-c)', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: 6, marginBottom: 4,
              display: 'flex', gap: 4,
            }} onClick={(e) => e.stopPropagation()}>
              <input
                className="orch-input"
                style={{ width: 120, fontSize: 12, padding: '3px 6px' }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setShowTagInput(false); }}
                autoFocus
              />
              <button className="orch-btn xs" onClick={handleAddTag}><TagIcon size={10} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}