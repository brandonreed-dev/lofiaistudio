import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { Skill } from '@lofiaistudio/shared';
import { Code2, Cpu, Download, Globe, MoreHorizontal, Play, Plus, Star, Tag as TagIcon, Trash2, Upload, Wrench } from 'lucide-react';
import { useStarredIds, useItemTags, EmptyState } from '../panelPrimitives';

type Tab = 'installed' | 'custom' | 'marketplace' | 'categories';

function triggerDownload(filename: string, content: unknown) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export function SkillsPanel() {
  const { skills, workflows, loadCollection, openDrawer, createEntity, deleteEntity, pushToast } = useOrchestrationStore();
  const [tab, setTab] = useState<Tab>('installed');
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState('All categories');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'runs' | 'latency' | 'category'>('name');
  const [showStarsOnly, setShowStarsOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCollection('skills');
    loadCollection('workflows');
  }, [loadCollection]);

  const { starredIds, toggle: toggleStar, isStarred } = useStarredIds('skills');
  const { addTag, removeTag, getTags } = useItemTags('skills');

  useEffect(() => {
    loadCollection('skills');
    loadCollection('workflows');
  }, [loadCollection]);

  const visible = useMemo(() => {
    let list = skills.filter(
      (skill) =>
        (cat === 'All categories' || skill.category === cat) &&
        (!filter || skill.name.toLowerCase().includes(filter.toLowerCase()) ||
          skill.description.toLowerCase().includes(filter.toLowerCase()) ||
          getTags(skill.id).some((t) => t.includes(filter.toLowerCase())))
    );
    if (showStarsOnly) list = list.filter((s) => isStarred(s.id));
    list.sort((a, b) => {
      switch (sortBy) {
        case 'runs': return b.runs7d - a.runs7d;
        case 'latency': return a.avgLatency.localeCompare(b.avgLatency);
        case 'category': return a.category.localeCompare(b.category);
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [skills, filter, cat, sortBy, showStarsOnly, isStarred, getTags]);

  const categories = useMemo(
    () => ['All categories', ...Array.from(new Set(skills.map((s) => s.category)))],
    [skills]
  );

  const importFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const text = await file.text().catch(() => null);
      if (!text) continue;
      let data: unknown;
      try { data = JSON.parse(text); } catch { pushToast(`Could not parse ${file.name}`); continue; }

      const entries: Partial<Skill>[] = Array.isArray(data) ? data as Partial<Skill>[] : [data as Partial<Skill>];
      for (const entry of entries) {
        if (!entry.name) { pushToast('Skipped entry with no name'); continue; }
        await createEntity('skills', {
          name: entry.name,
          category: entry.category ?? 'Imported',
          description: entry.description ?? '',
          usedBy: entry.usedBy ?? 0,
          runs7d: entry.runs7d ?? 0,
          avgLatency: entry.avgLatency ?? '—',
          cost: entry.cost ?? 'Free',
          enabled: entry.enabled ?? true,
          executionType: entry.executionType,
          endpoint: entry.endpoint,
          method: entry.method,
          workflowId: entry.workflowId,
          configSchema: entry.configSchema,
          runInputDefaults: entry.runInputDefaults,
        }).catch(() => pushToast(`Failed to import ${entry.name}`));
        pushToast(`Imported skill: ${entry.name}`);
      }
    }
  }, [createEntity, pushToast]);

  const runSkill = useCallback(async (skill: Skill) => {
    if (skill.executionType === 'workflow' && skill.workflowId) {
      const wf = workflows.find((w) => w.id === skill.workflowId);
      if (wf) {
        pushToast(`Triggering workflow "${wf.name}" from skill "${skill.name}"...`);
        try {
          await fetch(`/api/workflows/${wf.id}/run`, { method: 'POST' });
          pushToast(`Workflow "${wf.name}" started`);
        } catch {
          pushToast('Failed to run workflow');
        }
      } else {
        pushToast('Associated workflow not found');
      }
    } else if (skill.executionType === 'http' && skill.endpoint) {
      pushToast(`Running "${skill.name}"...`);
      try {
        const res = await fetch(`/api/skills/${skill.id}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: skill.runInputDefaults ?? {} }),
        });
        const data = await res.json();
        if (!data.success) {
          pushToast(data.error ?? 'Skill run failed');
          return;
        }
        const { status, result } = data.data as { status: number; result: unknown };
        const snippet = typeof result === 'string' ? result : JSON.stringify(result);
        pushToast(`HTTP ${status}: ${snippet.slice(0, 220)}${snippet.length > 220 ? '…' : ''}`);
        console.log(result);
      } catch {
        pushToast('Skill request failed');
      }
    } else {
      pushToast(`Skill "${skill.name}" executed (logging only)`);
    }
  }, [workflows, pushToast]);

  const marketplaceSkills = useMemo(
    () => [
      {
        id: 'mkt-reddit-top',
        name: 'reddit.subreddit_top',
        category: 'Web',
        description: 'Top posts in a subreddit (templates {subreddit}, {t}, {limit}). Calls reddit.com directly — portable.',
        usedBy: 0,
        runs7d: 0,
        avgLatency: '—',
        cost: 'Free',
        enabled: false,
        createdAt: '',
        updatedAt: '',
        executionType: 'http' as const,
        method: 'GET' as const,
        endpoint: 'https://www.reddit.com/r/{subreddit}/top.json?limit={limit}&t={t}&raw_json=1',
        runInputDefaults: { subreddit: 'gamedev', t: 'week', limit: 25 },
      },
      {
        id: 'mkt-reddit-topic',
        name: 'reddit.topic_comments',
        category: 'Web',
        description: 'Search comments by topic ({topic}, {limit}). Public Reddit JSON — works on any Studio.',
        usedBy: 0,
        runs7d: 0,
        avgLatency: '—',
        cost: 'Free',
        enabled: false,
        createdAt: '',
        updatedAt: '',
        executionType: 'http' as const,
        method: 'GET' as const,
        endpoint: 'https://www.reddit.com/search.json?q={topic}&type=comments&limit={limit}&raw_json=1',
        runInputDefaults: { topic: 'game development', limit: 25 },
      },
      {
        id: 'mkt-domain',
        name: 'domain.check_availability',
        category: 'Domain',
        description: 'Example fixed-URL HTTP skill (requires API key on the target).',
        usedBy: 1,
        runs7d: 4280,
        avgLatency: '0.4s',
        cost: 'Free',
        enabled: false,
        createdAt: '',
        updatedAt: '',
        executionType: 'http' as const,
        endpoint: 'https://domainr.p.rapidapi.com/v2/status',
        method: 'GET' as const,
      },
    ],
    []
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const skill of skills) {
      counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1);
    }
    return counts;
  }, [skills]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        const enabled = visible.find((s) => s.enabled);
        if (enabled) runSkill(enabled);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, runSkill]);

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Skills</h1>
          <p className="orch-view-subtitle">Reusable, versioned abilities. Use them in workflows or grant them to agents.</p>
        </div>
        <div className="orch-view-actions">
          <button className="orch-btn" onClick={() => fileRef.current?.click()}><Upload size={14} />Import</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }}
          />
          <button className="orch-btn"><Code2 />Browse marketplace</button>
          <button className="orch-btn primary" onClick={() => openDrawer('skill')}><Plus />New skill</button>
        </div>
      </div>

      <div className="orch-subtabs">
        {(['installed', 'custom', 'marketplace', 'categories'] as Tab[]).map((entry) => (
          <button key={entry} className={`orch-subtab${tab === entry ? ' active' : ''}`} onClick={() => { setTab(entry); setSelectedSkill(null); }}>
            {entry[0].toUpperCase() + entry.slice(1)}
            {entry === 'installed' && <span className="count">{skills.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'installed' && (
        <div className="orch-grid" style={{ gridTemplateColumns: selectedSkill ? '1fr 320px' : '1fr', gap: 14 }}>
          <div>
            <div className="orch-filter">
              <input className="orch-input" placeholder="Search skills..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              <select className="orch-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <select className="orch-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'runs' | 'latency' | 'category')}>
                <option value="name">Name</option>
                <option value="runs">Runs (7d)</option>
                <option value="latency">Latency</option>
                <option value="category">Category</option>
              </select>
              {skills.some((s) => isStarred(s.id)) && (
                <button
                  className={`orch-btn xs ${showStarsOnly ? '' : ' ghost'}`}
                  onClick={() => setShowStarsOnly(!showStarsOnly)}
                >
                  <Star size={12} />Starred
                </button>
              )}
            </div>

            <div className="orch-card">
              <table className="orch-table">
                <thead>
                  <tr>
                    <th style={{ width: 24 }} />
                    <th>Skill</th>
                    <th>Category</th>
                    <th>Execution</th>
                    <th>Used by</th>
                    <th>Runs (7d)</th>
                    <th>Avg latency</th>
                    <th>Cost</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
        {visible.map((skill) => (
                    <tr
                      key={skill.id}
                      onClick={() => setSelectedSkill(selectedSkill?.id === skill.id ? null : skill)}
                      style={selectedSkill?.id === skill.id ? { background: 'var(--bg-3)' } : undefined}
                    >
                      <td>
                        <button className="orch-icon-btn" style={{ width: 20, height: 20 }} onClick={(e) => { e.stopPropagation(); toggleStar(skill.id); }}>
                          <Star size={11} fill={isStarred(skill.id) ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="orch-row-icon" style={{ width: 28, height: 28, background: 'rgba(124,92,255,0.12)', color: 'var(--accent)' }}>
                            <Wrench size={13} />
                          </div>
                          <div>
                            <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>{skill.name}</strong>
                            <div className="orch-row-sub">{skill.description}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="orch-chip blue">{skill.category}</span></td>
                      <td>
                        {skill.executionType === 'http' ? (
                          <span className="orch-chip purple">HTTP</span>
                        ) : skill.executionType === 'workflow' ? (
                          <span className="orch-chip amber">Workflow</span>
                        ) : (
                          <span className="orch-chip">Internal</span>
                        )}
                      </td>
                      <td>{skill.usedBy}</td>
                      <td>{skill.runs7d.toLocaleString()}</td>
                      <td>{skill.avgLatency}</td>
                      <td>{skill.cost === 'Free' ? <span style={{ color: 'var(--green)' }}>Free</span> : skill.cost}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {skill.enabled && (
                            <button className="orch-icon-btn" title="Run skill" onClick={(e) => { e.stopPropagation(); runSkill(skill); }}>
                              <Play size={14} />
                            </button>
                          )}
                          <button className="orch-icon-btn" title="Export" onClick={(e) => { e.stopPropagation(); triggerDownload(skill.name + '.json', skill); }}>
                            <Download size={14} />
                          </button>
                          <button className="orch-icon-btn" title="Delete" style={{ color: 'var(--red)' }} onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete skill "${skill.name}"?`)) {
                              deleteEntity('skills', skill.id);
                            }
                          }}>
                            <Trash2 size={14} />
                          </button>
                          <button className="orch-icon-btn" onClick={(e) => { e.stopPropagation(); openDrawer('skill', skill.id); }}>
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && (
                <EmptyState title="No skills match your filters." />
              )}
            </div>
          </div>

          {selectedSkill && (
            <SkillDetailPanel
              skill={selectedSkill}
              workflows={workflows}
              tags={getTags(selectedSkill.id)}
              isStarred={isStarred(selectedSkill.id)}
              onToggleStar={() => toggleStar(selectedSkill.id)}
              onAddTag={(tag) => addTag(selectedSkill.id, tag)}
              onRemoveTag={(tag) => removeTag(selectedSkill.id, tag)}
              onRun={runSkill}
              onEdit={() => openDrawer('skill', selectedSkill.id)}
              onDelete={() => {
                if (window.confirm(`Delete skill "${selectedSkill.name}"?`)) {
                  deleteEntity('skills', selectedSkill.id);
                }
              }}
            />
          )}
        </div>
      )}

      {tab === 'custom' && (
        <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
          <div style={{ marginBottom: 16, fontWeight: 600 }}>Custom skills</div>
          <p style={{ fontSize: 13, marginBottom: 16 }}>Create your own skills by clicking "New skill" above. Custom skills can call HTTP endpoints, trigger workflows, or run inline logic inside workflows.</p>
          <button className="orch-btn primary" onClick={() => openDrawer('skill')}><Plus />New custom skill</button>
        </div>
      )}

      {tab === 'marketplace' && (
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title"><Globe size={14} />Marketplace</div>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{marketplaceSkills.length} available</span>
          </div>
          <table className="orch-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Category</th>
                <th>Execution</th>
                <th>Description</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {marketplaceSkills.map((skill) => (
                <tr key={skill.id}>
                  <td>
                    <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>{skill.name}</strong>
                  </td>
                  <td><span className="orch-chip blue">{skill.category}</span></td>
                  <td>
                    {skill.executionType === 'http' ? (
                      <span className="orch-chip purple">HTTP</span>
                    ) : (
                      <span className="orch-chip">Internal</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12.5 }}>{skill.description}</td>
                  <td>
                    <button className="orch-btn xs" onClick={() => {
                      createEntity('skills', {
                        name: skill.name,
                        category: skill.category,
                        description: skill.description,
                        usedBy: 0,
                        runs7d: 0,
                        avgLatency: skill.avgLatency,
                        cost: skill.cost,
                        enabled: true,
                        executionType: skill.executionType,
                        endpoint: skill.executionType === 'http' ? skill.endpoint : undefined,
                        method: skill.executionType === 'http' ? skill.method : undefined,
                        runInputDefaults: 'runInputDefaults' in skill ? skill.runInputDefaults : undefined,
                        configSchema: 'configSchema' in skill ? (skill as { configSchema?: Record<string, unknown> }).configSchema : undefined,
                      }).then(() => pushToast(`Installed skill: ${skill.name}`)).catch(() => pushToast(`Failed to install ${skill.name}`));
                    }}>Install</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'categories' && (
        <div className="orch-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {Array.from(categoryCounts.entries()).map(([category, count]) => (
            <div
              className="orch-card"
              key={category}
              style={{ padding: 20, cursor: 'pointer' }}
              onClick={() => { setCat(category); setTab('installed'); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="orch-chip blue">{category}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>{count}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>
                {count} skill{count !== 1 ? 's' : ''} installed
              </div>
            </div>
          ))}
          {categoryCounts.size === 0 && (
            <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
              No skills installed yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skill Detail Panel ──────────────────────────────────────────────────────

function SkillDetailPanel({ skill, workflows, tags, isStarred, onToggleStar, onAddTag, onRemoveTag, onRun, onEdit, onDelete }: {
  skill: Skill;
  workflows: { id: string; name: string }[];
  tags: string[];
  isStarred: boolean;
  onToggleStar: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onRun: (skill: Skill) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const linkedWorkflow = skill.workflowId ? workflows.find((w) => w.id === skill.workflowId) : null;
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
        <div className="orch-card-header">
          <div className="orch-card-title">
            <Wrench size={14} />
            {skill.name}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="orch-icon-btn" onClick={onToggleStar}>
              <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
            <span className={`orch-chip ${skill.enabled ? 'green' : 'amber'}`}>
              {skill.enabled ? 'active' : 'disabled'}
            </span>
          </div>
        </div>
      <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Description</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{skill.description || 'No description.'}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Category</div>
            <span className="orch-chip blue" style={{ marginTop: 4 }}>{skill.category}</span>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Execution</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {skill.executionType === 'http' ? 'HTTP Call' : skill.executionType === 'workflow' ? 'Workflow trigger' : 'Internal'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Cost</div>
            <div style={{ marginTop: 4, fontSize: 13, color: skill.cost === 'Free' ? 'var(--green)' : undefined }}>{skill.cost}</div>
          </div>
        </div>

        {skill.executionType === 'http' && skill.endpoint && (
          <>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Endpoint</div>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', wordBreak: 'break-all' }}>
                {skill.method ?? 'POST'} {skill.endpoint}
              </div>
            </div>
            {skill.runInputDefaults && Object.keys(skill.runInputDefaults).length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Run defaults</div>
                <pre style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-2)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(skill.runInputDefaults, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}

        {skill.executionType === 'workflow' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Linked workflow</div>
            <div style={{ fontSize: 13 }}>
              {linkedWorkflow ? linkedWorkflow.name : <span style={{ color: 'var(--red)' }}>Workflow not found</span>}
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {tags.map((tag) => (
              <span key={tag} className="orch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11 }}>
                {tag}
                <button
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  onClick={() => onRemoveTag(tag)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="orch-input"
              style={{ flex: 1, fontSize: 12, padding: '3px 6px' }}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag..."
              onKeyDown={(e) => { if (e.key === 'Enter' && tagInput.trim()) { onAddTag(tagInput.trim()); setTagInput(''); } }}
            />
            <button className="orch-btn xs" onClick={() => { if (tagInput.trim()) { onAddTag(tagInput.trim()); setTagInput(''); } }}>
              <TagIcon size={12} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button className="orch-btn primary" style={{ flex: 1 }} onClick={() => onRun(skill)} disabled={!skill.enabled}>
            <Play size={14} />Run
          </button>
          <button className="orch-btn" onClick={onEdit}><MoreHorizontal size={14} />Edit</button>
          <button className="orch-btn" onClick={() => triggerDownload(skill.name + '.json', skill)}><Download size={14} />Export</button>
          <button className="orch-btn" style={{ color: 'var(--red)' }} onClick={onDelete}><Trash2 size={14} />Delete</button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
          {skill.usedBy} workflows · {skill.runs7d.toLocaleString()} runs (7d) · {skill.avgLatency} avg
        </div>
      </div>
    </div>
  );
}