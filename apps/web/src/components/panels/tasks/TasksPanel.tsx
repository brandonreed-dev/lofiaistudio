import { useEffect, useMemo, useState } from 'react';
import { useOrchestrationStore } from '@/stores/orchestration';
import { Clock, MoreHorizontal, Play, Plus } from 'lucide-react';
import { EmptyState } from '../panelPrimitives';

type Tab = 'scheduled' | 'event' | 'manual' | 'history';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function genHeatmap(): string[][] {
  return DAYS.map(() =>
    Array.from({ length: 24 }, () => {
      const v = Math.random();
      return v > 0.85 ? 'l3' : v > 0.6 ? 'l2' : v > 0.35 ? 'l1' : '';
    })
  );
}

export function TasksPanel() {
  const { tasks, workflows, agents, workflowRuns, loadAll, openDrawer, runTask } = useOrchestrationStore();
  const [tab, setTab] = useState<Tab>('scheduled');
  const heatmap = useMemo(genHeatmap, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const scheduledTasks = useMemo(() => tasks.filter((t) => !!t.cron && t.enabled), [tasks]);

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Tasks &amp; Schedules</h1>
          <p className="orch-view-subtitle">When agents wake up and what they do. Cron, event triggers, and on-demand jobs.</p>
        </div>
        <div className="orch-view-actions">
          <button className="orch-btn primary" onClick={() => openDrawer('task')}><Plus />New task</button>
        </div>
      </div>

      <div className="orch-subtabs">
        <button className={`orch-subtab${tab === 'scheduled' ? ' active' : ''}`} onClick={() => setTab('scheduled')}>Scheduled <span className="count">{tasks.length}</span></button>
        <button className={`orch-subtab${tab === 'event' ? ' active' : ''}`} onClick={() => setTab('event')}>Event-driven</button>
        <button className={`orch-subtab${tab === 'manual' ? ' active' : ''}`} onClick={() => setTab('manual')}>Manual</button>
        <button className={`orch-subtab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'history' ? (
        <div className="orch-card">
          <div className="orch-list">
            {workflowRuns.map((run) => (
              <div className="orch-row" key={run.id}>
                <div className="orch-row-icon"><Clock size={14} /></div>
                <div className="orch-row-main">
                  <div className="orch-row-title">{run.workflowName} <span className={`orch-chip ${run.status === 'failed' ? 'red' : 'green'}`}>{run.status}</span></div>
                  <div className="orch-row-sub">Triggered by {run.trigger}</div>
                </div>
                <div className="orch-row-meta">{new Date(run.startedAt).toLocaleString()}</div>
              </div>
            ))}
            {workflowRuns.length === 0 && <EmptyState title="No runs yet." subtitle="Run a workflow or task to see history." />}
          </div>
        </div>
      ) : (
        <div className="orch-grid orch-grid-2-1" style={{ marginBottom: 14 }}>
          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title">Upcoming runs / next 24h</div>
            </div>
            <div className="orch-list">
              {scheduledTasks.map((task) => {
                const workflow = workflows.find((entry) => entry.id === task.workflowId);
                const agent = agents.find((entry) => entry.id === task.agentId);
                return (
                  <div className="orch-row" key={task.id}>
                    <div className="orch-row-icon" style={{ background: 'rgba(124,92,255,0.15)', color: 'var(--accent)' }}>
                      <Clock size={14} />
                    </div>
                    <div className="orch-row-main">
                      <div className="orch-row-title">
                        {task.name} <span className="orch-chip">{agent?.name ?? 'system'}</span>
                      </div>
                      <div className="orch-row-sub">
                        <code className="orch-code">{task.cron}</code> / workflow: {workflow?.name ?? 'none'} / last: {task.lastStatus ?? 'none'}
                      </div>
                    </div>
                    <div className="orch-row-meta">{task.nextRunAt ? relativeTime(task.nextRunAt) : 'not scheduled'}</div>
                    <button className="orch-icon-btn" title="Run now" onClick={() => runTask(task.id)}><Play size={14} /></button>
                    <button className="orch-icon-btn" onClick={() => openDrawer('task', task.id)}><MoreHorizontal size={14} /></button>
                  </div>
                );
              })}
              {scheduledTasks.length === 0 && <EmptyState title="No scheduled tasks." subtitle="Create a task to schedule work." />}
            </div>
          </div>

          <div className="orch-card">
            <div className="orch-card-header">
              <div className="orch-card-title">Run heatmap / this week</div>
            </div>
            <div className="orch-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DAYS.map((day, i) => (
                  <div key={day} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 26, fontSize: 11, color: 'var(--text-2)' }}>{day}</span>
                    <div className="orch-cron-grid" style={{ flex: 1 }}>
                      {heatmap[i].map((cls, h) => <div key={h} className={`orch-cron-cell${cls ? ' ' + cls : ''}`} title={`${h}:00`} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function relativeTime(value: string) {
  const delta = Date.parse(value) - Date.now();
  const abs = Math.abs(delta);
  const suffix = delta >= 0 ? 'from now' : 'ago';
  const minutes = Math.round(abs / 60000);
  if (minutes < 1) return delta >= 0 ? 'now' : 'just now';
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  return new Date(value).toLocaleDateString();
}
