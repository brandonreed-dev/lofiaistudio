import { useEffect, useMemo, useState } from 'react';
import { useModelStore, useRuntimeStore, useAppStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { View } from '@/stores';
import type { ActivityEvent } from '@lofiaistudio/shared';
import { Activity, Archive, CheckCircle, Globe, Grid3X3, List as ListIcon, Package, PauseCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ProjectEditor } from './projects/ProjectEditor';
import { CloudProvidersPanel } from './integrations/CloudProvidersPanel';
import { ServersPanel } from './servers/ServersPanel';
import { ModelsPanel } from './models/ModelsPanel';
import { UsersPanel } from './users/UsersPanel';
import { SimpleGrid } from './SimpleGrid';
import { SettingsPanel } from './settings/SettingsPanel';
import { LicensePanel } from './license/LicensePanel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { CodePanel } from './code/CodePanel';

const COPY: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'System overview and quick actions' },
  agents: { title: 'Agents', subtitle: 'Manage your AI agents' },
  workflows: { title: 'Workflows', subtitle: 'Automate complex tasks' },
  skills: { title: 'Skills', subtitle: 'Extend agent capabilities' },
  tasks: { title: 'Tasks & Schedules', subtitle: 'Automated task execution' },
  servers: { title: 'Servers', subtitle: 'Runtime connections and status' },
  models: { title: 'Models', subtitle: 'Available AI models across runtimes' },
  storage: { title: 'Storage & Vectors', subtitle: 'File storage and vector databases' },
  projects: { title: 'Projects', subtitle: 'Organize your work' },
  users: { title: 'Users', subtitle: 'Team members and account management' },
  'project-editor': { title: 'Project Editor', subtitle: 'Edit project environments and resources' },
  integrations: { title: 'Integrations', subtitle: 'Third-party service connections' },
  activity: { title: 'Activity', subtitle: 'Logging and observability' },
  license: { title: 'License', subtitle: 'License information and community support' },
  settings: { title: 'Settings', subtitle: 'Configure runtimes, defaults, and preferences' },
  text: { title: 'Text', subtitle: 'Text generation workspace' },
  image: { title: 'Image', subtitle: 'Image generation workspace' },
  audio: { title: 'Audio', subtitle: 'Audio processing workspace' },
  video: { title: 'Video', subtitle: 'Video generation workspace' },
};

const COMPANY_COLORS: Record<string, string> = {
  'resource.sync.completed': '#8884d8',
  'runtime.text.completed': '#82ca9d',
  'runtime.image.completed': '#ffc658',
  'runtime.video.completed': '#fd7e14',
  'runtime.audio.transcribed': '#6f42c1',
  'runtime.audio.synthesized': '#e83e8c',
  'workflow.completed': '#20c997',
  'workflow.failed': '#dc3545',
  'agent.created': '#fd7e14',
  'skill.executed': '#6610f2',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  'resource.sync.completed': 'Resource Sync',
  'runtime.text.completed': 'Text Generation',
  'runtime.image.completed': 'Image Generation',
  'runtime.video.completed': 'Video Generation',
  'runtime.audio.transcribed': 'Audio Transcription',
  'runtime.audio.synthesized': 'Speech Synthesis',
  'workflow.completed': 'Workflow Completed',
  'workflow.failed': 'Workflow Failed',
  'agent.created': 'Agent Created',
  'skill.executed': 'Skill Executed',
  'webhook.triggered': 'Webhook Triggered',
  'workflow.version.restored': 'Workflow Version Restored',
};

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

function getTimeRangeMs(range: TimeRange): number {
  switch (range) {
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
  }
}

export function OrchestrationPanel({ view }: { view: View }) {
  const { runtimes, connectRuntimes, error: runtimeError } = useRuntimeStore();
  const { models, fetchModels } = useModelStore();
  const {
    activity, projects, integrations, users, openDrawer, loadAll,
    loadFilteredActivity, exportFilteredActivity, updateEntity, deleteEntity,
    pushToast, agents, workflows, isLoading, error: orchestrationError,
  } = useOrchestrationStore();

  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [editorProjectId, setEditorProjectId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [projectTab, setProjectTab] = useState<'grid' | 'list'>('grid');
  const [projectFilter, setProjectFilter] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all');
  const [projectEnvFilter, setProjectEnvFilter] = useState<string>('all');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const { setActiveView } = useAppStore();

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (view === 'models') {
      fetchModels('text');
      fetchModels('image');
      fetchModels('audio');
      fetchModels('video');
    }
  }, [fetchModels, view]);

  useEffect(() => {
    if (view === 'activity') {
      const from = new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString();
      loadFilteredActivity({ from, projectId: selectedProject === 'all' ? undefined : selectedProject, environment: selectedEnvironment === 'all' ? undefined : selectedEnvironment, q: searchQuery || undefined, types: selectedTypes.length ? selectedTypes.join(',') : undefined, limit: '500' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, timeRange, selectedProject, selectedEnvironment, searchQuery, selectedTypes, loadFilteredActivity]);

  const copy = COPY[view] || { title: view, subtitle: '' };
  const allModels = useMemo(() => [...models.text, ...models.image, ...models.audio, ...models.video], [models]);

  const visibleProjects = useMemo(() => {
    let list = projects;
    if (projectStatusFilter !== 'all') list = list.filter((p) => p.status === projectStatusFilter);
    if (projectEnvFilter !== 'all') list = list.filter((p) => p.environment === projectEnvFilter);
    if (projectFilter) {
      const q = projectFilter.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return list;
  }, [projects, projectStatusFilter, projectEnvFilter, projectFilter]);

  const filteredActivity = useMemo(() => {
    if (!selectedTypes.length) return activity;
    const allowed = new Set(selectedTypes);
    return activity.filter((event: ActivityEvent) => allowed.has(event.type));
  }, [activity, selectedTypes]);

  const projectStats = useMemo(() => ({
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    paused: projects.filter((p) => p.status === 'paused').length,
    archived: projects.filter((p) => p.status === 'archived').length,
  }), [projects]);

  const toggleProjectSelection = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    for (const id of selectedProjectIds) {
      await updateEntity('projects', id, { status: 'archived' } as any);
    }
    pushToast(`Archived ${selectedProjectIds.size} project(s)`);
    setSelectedProjectIds(new Set());
  };

  const handleBulkDelete = async () => {
    for (const id of selectedProjectIds) {
      await deleteEntity('projects', id);
    }
    pushToast(`Deleted ${selectedProjectIds.size} project(s)`);
    setSelectedProjectIds(new Set());
  };

  const handleDuplicateProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    await useOrchestrationStore.getState().createEntity('projects', {
      name: `${project.name} (copy)`,
      description: project.description,
      status: 'active',
      environment: project.environment,
      nodes: project.nodes,
      edges: project.edges,
      members: [],
      retentionDays: project.retentionDays,
    });
    pushToast(`Duplicated project: ${project.name}`);
  };

  const activityStats = useMemo(() => {
    const source = filteredActivity;
    if (!source || source.length === 0) {
      return { total: 0, successRate: 0, todayCount: 0, avgPerHour: 0, typeDistribution: [], timelineData: [] };
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentActivity = source.filter((event) => new Date(event.createdAt) >= twentyFourHoursAgo);
    const typeCounts = source.reduce((acc, event) => { acc[event.type] = (acc[event.type] || 0) + 1; return acc; }, {} as Record<string, number>);
    const successfulActivities = source.filter((event) => event.tone === 'green').length;
    const successRate = source.length > 0 ? Math.round((successfulActivities / source.length) * 100) : 0;
    const timelineData = Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23 - i, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      const count = source.filter((event) => { const et = new Date(event.createdAt); return et >= hourStart && et < hourEnd; }).length;
      return { hour: `${23 - i}:00`, count };
    }).reverse();
    const typeDistribution = Object.entries(typeCounts).map(([type, count]) => ({
      name: ACTIVITY_TYPE_LABELS[type] || type, value: count, color: COMPANY_COLORS[type] || '#6c757d',
    })).sort((a, b) => b.value - a.value);
    return { total: source.length, successRate, todayCount: recentActivity.length, avgPerHour: Math.round(recentActivity.length / 24), typeDistribution, timelineData };
  }, [filteredActivity]);

  const openProjectEditor = (projectId: string) => {
    setEditorProjectId(projectId);
    setActiveView('project-editor');
  };

  // Show loading state for data-heavy views
  if (isLoading && !activity.length && !projects.length && !agents.length) {
    return (
      <div className="orch-view">
        <div className="orch-view-header">
          <div>
            <h1 className="orch-view-title">{copy?.title || view}</h1>
            <p className="orch-view-subtitle">{copy?.subtitle || ''}</p>
          </div>
        </div>
        <div className="orch-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Loading...</div>
          <div style={{ fontSize: 12 }}>Fetching data from server</div>
        </div>
      </div>
    );
  }

  if (orchestrationError) {
    return (
      <div className="orch-view">
        <div className="orch-view-header">
          <div>
            <h1 className="orch-view-title">{copy?.title || view}</h1>
            <p className="orch-view-subtitle">{copy?.subtitle || ''}</p>
          </div>
        </div>
        <div className="orch-card" style={{ padding: 48, textAlign: 'center', color: 'var(--red)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Error loading data</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{orchestrationError}</div>
          <button className="orch-btn primary" style={{ marginTop: 12 }} onClick={loadAll}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">{copy?.title || view}</h1>
          <p className="orch-view-subtitle">{copy?.subtitle || ''}</p>
        </div>
        <div className="orch-view-actions">
          {isLoading && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Loading...</span>}
          {view === 'servers' && <button className="orch-btn primary" onClick={connectRuntimes}>Refresh runtimes</button>}
          {view === 'projects' && <button className="orch-btn primary" onClick={() => openDrawer('project')}><Plus size={14} /> New project</button>}
          {view === 'integrations' && <button className="orch-btn primary" onClick={() => openDrawer('integration')}>Add integration</button>}
        </div>
      </div>

      {view === 'servers' && <ServersPanel runtimes={runtimes} onRefresh={connectRuntimes} error={runtimeError} />}

      {view === 'models' && <ModelsPanel allModels={allModels} />}

      {view === 'activity' && (
        <div className="orch-card">
          <div className="orch-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="orch-card-title"><Activity size={20} /> Activity Analytics</div>
            <div className="orch-filter" style={{ display: 'flex', gap: 8 }}>
              <select className="orch-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <input className="orch-select" placeholder="Search activity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <select className="orch-select" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                <option value="all">All Projects</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <select className="orch-select" value={selectedEnvironment} onChange={(e) => setSelectedEnvironment(e.target.value)}>
                <option value="all">All Environments</option>
                <option value="environment.dev">Dev</option>
                <option value="environment.staging">Staging</option>
                <option value="environment.prod">Production</option>
              </select>
              <button className="orch-btn xs" onClick={() => exportFilteredActivity({ from: new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString(), projectId: selectedProject === 'all' ? undefined : selectedProject, environment: selectedEnvironment === 'all' ? undefined : selectedEnvironment, q: searchQuery || undefined, limit: '1000' }, 'csv')}>Export CSV</button>
              <button className="orch-btn xs" onClick={() => exportFilteredActivity({ from: new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString(), projectId: selectedProject === 'all' ? undefined : selectedProject, environment: selectedEnvironment === 'all' ? undefined : selectedEnvironment, q: searchQuery || undefined, limit: '1000' }, 'json')}>Export JSON</button>
            </div>
          </div>
          <div className="orch-card-body" style={{ padding: '20px' }}>
            <div className="orch-grid orch-grid-4" style={{ marginBottom: '24px' }}>
              {[{ label: 'Total Events', value: activityStats.total, color: '#8884d8' }, { label: 'Success Rate', value: `${activityStats.successRate}%`, color: '#82ca9d' }, { label: 'Today', value: activityStats.todayCount, color: '#ffc658' }, { label: 'Estimated Cost (USD)', value: (() => { const totalCost = filteredActivity.reduce((sum, e) => sum + (e.cost?.amount || 0), 0); return totalCost.toFixed(2); })(), color: '#fd7e14' }].map((stat) => (
                <div key={stat.label} className="orch-stat" style={{ '--bar-color': stat.color } as React.CSSProperties}>
                  <div className="orch-stat-icon"><Activity size={20} /></div>
                  <div className="orch-stat-content">
                    <div className="orch-stat-value">{stat.value}</div>
                    <div className="orch-stat-label">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* <div className="orch-card" style={{ height: '300px' }}>
              <div className="orch-card-header"><div className="orch-card-title">Cost by Model / Provider</div></div>
              <div className="orch-card-body" style={{ padding: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => { const map: Record<string, number> = {}; filteredActivity.forEach((e) => { const key = e.cost?.model || e.cost?.provider || 'unknown'; map[key] = (map[key] || 0) + (e.cost?.amount || 0); }); return Object.entries(map).map(([name, amount]) => ({ name, amount: Number(amount.toFixed(4)) })); })()}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend verticalAlign="top" height={36} /><Bar dataKey="amount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div> */}
            {/* <div className="orch-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div className="orch-card" style={{ height: '300px' }}>
                <div className="orch-card-header"><div className="orch-card-title">Activity Timeline (Last 24h)</div></div>
                <div className="orch-card-body" style={{ padding: '10px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityStats.timelineData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend verticalAlign="top" height={36} /><Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="orch-card" style={{ height: '300px' }}>
                <div className="orch-card-header"><div className="orch-card-title">Activity by Type</div></div>
                <div className="orch-card-body" style={{ padding: '10px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={activityStats.typeDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value, percent }) => <div style={{ fontSize: 12, fontWeight: 600, fill: '#fff' }}>{name}: {percent}% ({value})</div>} dataKey="value" nameKey="name">
                        {activityStats.typeDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div> */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {['all', 'text', 'image', 'video', 'audio', 'workflow', 'agent', 'skill'].map((chip) => {
                const isActive = chip === 'all' ? selectedTypes.length === 0 : selectedTypes.includes(chip);
                const label = chip === 'all' ? 'All' : chip.charAt(0).toUpperCase() + chip.slice(1);
                return (<button key={chip} className={`orch-chip${isActive ? ' blue' : ''}`} style={{ cursor: 'pointer' }} onClick={() => { if (chip === 'all') setSelectedTypes([]); else setSelectedTypes((prev) => prev.includes(chip) ? prev.filter((t) => t !== chip) : [...prev, chip]); }}>{label}</button>);
              })}
            </div>
            <div className="orch-card">
              <div className="orch-card-header"><div className="orch-card-title">Recent Activity</div></div>
              <div className="orch-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredActivity.slice(0, 20).map((event: ActivityEvent) => {
                  const isSuccess = event.tone === 'green';
                  return (<div key={event.id} className={`orch-row${isSuccess ? ' success' : ''}`} style={{ borderLeft: `4px solid ${ACTIVITY_TYPE_LABELS[event.type] ? COMPANY_COLORS[event.type] || '#6c757d' : '#6c757d'}`, paddingLeft: '12px' }}>
                    <div className="orch-row-icon"><Activity size={16} color={isSuccess ? '#28a745' : '#dc3545'} /></div>
                    <div className="orch-row-main">
                      <div className="orch-row-title"><span className="orch-badge" style={{ backgroundColor: COMPANY_COLORS[event.type] || '#6c757d', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, marginRight: '8px' }}>{ACTIVITY_TYPE_LABELS[event.type] || event.type}</span>{event.title}</div>
                      <div className="orch-row-sub">{event.message}</div>
                    </div>
                    <div className="orch-row-meta" style={{ fontSize: 11 }}>{new Date(event.createdAt).toLocaleString()}{isSuccess && <span className="orch-dot pulse" style={{ marginLeft: '8px' }} />}</div>
                  </div>);
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'projects' && (
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title"><Package size={16} /> Projects</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="orch-segmented">
                <button className={projectTab === 'grid' ? 'active' : ''} onClick={() => setProjectTab('grid')} title="Grid view"><Grid3X3 size={14} /></button>
                <button className={projectTab === 'list' ? 'active' : ''} onClick={() => setProjectTab('list')} title="List view"><ListIcon size={14} /></button>
              </div>
              <button className="orch-btn primary" onClick={() => openDrawer('project')}><Plus size={14} /> New project</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border-c)', flexWrap: 'wrap' }}>
            {[{ key: 'all', label: `All (${projectStats.total})` }, { key: 'active', label: `Active (${projectStats.active})`, cls: 'green' }, { key: 'paused', label: `Paused (${projectStats.paused})`, cls: 'amber' }, { key: 'archived', label: `Archived (${projectStats.archived})` }].map((chip) => (
              <span key={chip.key} className={`orch-chip${projectStatusFilter === chip.key ? ' blue' : ''}${chip.cls ? ` ${chip.cls}` : ''}`} style={{ cursor: 'pointer', opacity: projectStatusFilter === chip.key || chip.key === 'all' ? 1 : 0.6 }} onClick={() => setProjectStatusFilter(chip.key)}>
                {chip.key !== 'all' && chip.key === 'active' ? <CheckCircle size={10} /> : chip.key === 'paused' ? <PauseCircle size={10} /> : chip.key === 'archived' ? <Archive size={10} /> : null} {chip.label}
              </span>
            ))}
          </div>
          <div className="orch-filter" style={{ padding: '8px 16px' }}>
            <input className="orch-input" placeholder="Search projects..." value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ flex: 1 }} />
            <select className="orch-select" value={projectEnvFilter} onChange={(e) => setProjectEnvFilter(e.target.value)}>
              <option value="all">All environments</option>
              <option value="local">Local</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          {selectedProjectIds.size > 0 && (
            <div style={{ padding: '8px 16px', background: 'var(--bg-3)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{selectedProjectIds.size} selected</span>
              <button className="orch-btn xs" onClick={handleBulkArchive}><Archive size={12} /> Archive</button>
              <button className="orch-btn xs" style={{ color: 'var(--red)' }} onClick={handleBulkDelete}><Trash2 size={12} /> Delete</button>
              <button className="orch-btn xs ghost" onClick={() => setSelectedProjectIds(new Set())}>Clear</button>
            </div>
          )}
          <div className="orch-card-body">
            {projects.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
                <Package size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p>No projects yet. Create one to organize workflows, agents, and files.</p>
                <button className="orch-btn primary" style={{ marginTop: 12 }} onClick={() => openDrawer('project')}><Plus size={14} /> New project</button>
              </div>
            )}
            {projectTab === 'grid' && visibleProjects.length > 0 && (
              <div className="orch-grid orch-grid-3">
                {visibleProjects.map((project) => {
                  const envCount = (project.nodes ?? []).filter((n) => n.type.startsWith('environment.')).length;
                  const nodeCount = (project.nodes ?? []).length;
                  return (
                    <div key={project.id} className="orch-card" style={{ position: 'relative' }}>
                      <div className="orch-card-body" style={{ cursor: 'pointer' }} onClick={() => openProjectEditor(project.id)}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={(e) => { e.stopPropagation(); toggleProjectSelection(project.id); }} onClick={(e) => e.stopPropagation()} />
                            <Package size={20} style={{ color: 'var(--accent)' }} />
                          </div>
                          <span className={`orch-chip ${project.status === 'active' ? 'green' : project.status === 'paused' ? 'amber' : ''}`}>{project.status}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                          {project.name}
                          {project.id === 'project-lofiaistudio' && <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 4, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', marginLeft: 6, verticalAlign: 'middle' }}>Reference</span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.35 }}>{project.description || 'No description.'}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="orch-chip blue" style={{ fontSize: 10.5 }}>{project.environment}</span>
                          <span className="orch-chip" style={{ fontSize: 10.5 }}>{nodeCount} nodes</span>
                          <span className="orch-chip" style={{ fontSize: 10.5 }}>{envCount} env{envCount !== 1 ? 's' : ''}</span>
                          <span className="orch-chip" style={{ fontSize: 10.5 }}>{(project.members ?? []).length} member{(project.members ?? []).length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', borderTop: '1px solid var(--border-c)', paddingTop: 8, marginTop: 4 }}>
                        <button className="orch-btn xs" style={{ flex: 1 }} onClick={() => openProjectEditor(project.id)}>Open editor</button>
                        <button className="orch-btn xs ghost" onClick={() => handleDuplicateProject(project.id)} title="Duplicate">Duplicate</button>
                        <button className="orch-btn xs ghost" style={{ color: 'var(--text-3)' }} onClick={async () => { await updateEntity('projects', project.id, { status: project.status === 'archived' ? 'active' : 'archived' } as any); pushToast(project.status === 'archived' ? 'Project restored' : 'Project archived'); }}>{project.status === 'archived' ? <RefreshCw size={12} /> : <Archive size={12} />}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {projectTab === 'list' && visibleProjects.length > 0 && (
              <div className="orch-list">
                {visibleProjects.map((project) => {
                  const envCount = (project.nodes ?? []).filter((n) => n.type.startsWith('environment.')).length;
                  const nodeCount = (project.nodes ?? []).length;
                  return (
                    <div key={project.id} className="orch-row" style={{ cursor: 'pointer' }} onClick={() => openProjectEditor(project.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={() => toggleProjectSelection(project.id)} />
                      </div>
                      <div className="orch-row-icon"><Package /></div>
                      <div className="orch-row-main">
                        <div className="orch-row-title">
                          {project.name}
                          {project.id === 'project-lofiaistudio' && <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 4, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', marginLeft: 6, verticalAlign: 'middle' }}>Reference</span>}
                          <span className={`orch-chip ${project.status === 'active' ? 'green' : project.status === 'paused' ? 'amber' : ''}`} style={{ marginLeft: 8 }}>{project.status}</span>
                          <span className="orch-chip blue" style={{ marginLeft: 6 }}>{project.environment}</span>
                        </div>
                        <div className="orch-row-sub">{project.description}</div>
                        <div className="orch-row-sub">{nodeCount} node{nodeCount !== 1 ? 's' : ''} · {envCount} environment{envCount !== 1 ? 's' : ''} · {(project.members ?? []).length} member{(project.members ?? []).length !== 1 ? 's' : ''} · retention {project.retentionDays}d</div>
                      </div>
                      <div className="orch-row-actions" style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button className="orch-btn xs" onClick={() => openProjectEditor(project.id)}>Open editor</button>
                        <button className="orch-btn xs ghost" onClick={() => handleDuplicateProject(project.id)} title="Duplicate">Duplicate</button>
                        <button className="orch-btn xs ghost" style={{ color: 'var(--text-3)' }} onClick={async () => { await updateEntity('projects', project.id, { status: project.status === 'archived' ? 'active' : 'archived' } as any); pushToast(project.status === 'archived' ? 'Project restored' : 'Project archived'); }}>{project.status === 'archived' ? <RefreshCw size={12} /> : <Archive size={12} />}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {visibleProjects.length === 0 && projects.length > 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>No projects match your filters.</div>
            )}
          </div>
        </div>
      )}

      {view === 'project-editor' && editorProjectId && (
        <div className="orch-card">
          <div className="orch-card-body">
            <ProjectEditorView projectId={editorProjectId} onSelect={(id: string) => setEditorProjectId(id)} />
          </div>
        </div>
      )}

      {view === 'integrations' && <CloudProvidersPanel />}

      {view === 'code' && <CodePanel />}

      {view === 'license' && <LicensePanel />}

      {view === 'settings' && <SettingsPanel />}

      {view === 'plugins'}

      {view === 'posts'}

      {view === 'issues'}

      {view === 'reports'}
    </div>
  );
}

function ProjectEditorView({ projectId, onSelect }: { projectId: string; onSelect?: (id: string) => void }) {
  const { projects, loadAll } = useOrchestrationStore();
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!project) {
      loadAll();
    }
  }, [project, loadAll]);

  if (!project) {
    return <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading project...</div>;
  }
  return <ProjectEditor project={project} onSelect={onSelect} />;
}