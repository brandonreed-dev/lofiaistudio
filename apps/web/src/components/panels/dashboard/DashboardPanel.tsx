import { useEffect, useMemo, useState } from 'react';
import { useAppStore, useRuntimeStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronsRight,
  Clock,
  Cloud,
  Cpu,
  Image as ImageIcon,
  MessageSquare,
  PlayCircle,
  Plus,
  RefreshCw,
  Users,
  Video,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';
import { EmptyState } from '../panelPrimitives';

const TIME_RANGES = ['Today', '7d', '30d', '90d'] as const;

export function DashboardPanel() {
  const [range, setRange] = useState<(typeof TIME_RANGES)[number]>('7d');
  const { executionMode, setActiveView } = useAppStore();
  const { runtimes, connectRuntimes } = useRuntimeStore();
  const { summary, loadSummary, openDrawer, runWorkflow } = useOrchestrationStore();

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const recentRuns = summary?.recentRuns ?? [];
  const activity = summary?.activity ?? [];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const connected = summary?.runtimes.connected ?? runtimes.filter((runtime) => runtime.connected).length;
  const totalRuntimes = summary?.runtimes.total ?? runtimes.length;
  const modelCount = summary?.runtimes.models ?? runtimes.reduce((sum, runtime) => sum + runtime.models.length, 0);
  const nextTask = summary?.tasks.nextRunAt ? relativeTime(summary.tasks.nextRunAt) : 'not scheduled';

  return (
    <div className="orch-view">
      <div className="orch-banner">
        <div className="orch-banner-icon">
          <CheckCircle2 />
        </div>
        <div className="orch-banner-text">
          <strong>{executionMode === 'local' ? 'Local-first mode active.' : 'Cloud burst mode active.'}</strong>{' '}
          {executionMode === 'local'
            ? `${connected}/${totalRuntimes || 0} runtimes online. No automatic cloud fallback.`
            : 'Routing inference through configured cloud providers.'}
        </div>
        <button className="orch-btn xs ghost" onClick={() => setActiveView('servers')}>
          Runtime hub
        </button>
      </div>

      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">{greeting}, Brandon</h1>
          <p className="orch-view-subtitle">
            Your local studio has {connected} runtime{connected === 1 ? '' : 's'} online, {modelCount} discovered models,
            and {summary?.workflows.runs24h ?? 0} workflow runs in the last 24h.
          </p>
        </div>
        <div className="orch-view-actions">
          <div className="orch-segmented">
            {TIME_RANGES.map((r) => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
          <button
            className="orch-btn sm"
            onClick={() => {
              connectRuntimes();
              loadSummary();
            }}
          >
            <RefreshCw />
            Refresh
          </button>
        </div>
      </div>

      <div className="orch-grid orch-grid-4" style={{ marginBottom: 18 }}>
        <StatCard icon={<Users />} value={`${summary?.agents.active ?? 0} / ${summary?.agents.total ?? 0}`} label="Active agents" barColor="var(--accent)" iconBg="rgba(124,92,255,0.12)" iconColor="var(--accent)" />
        <StatCard icon={<Workflow />} value={String(summary?.workflows.runs24h ?? 0)} label="Workflow runs / 24h" barColor="var(--green)" iconBg="rgba(16,185,129,0.12)" iconColor="var(--green)" />
        <StatCard icon={<Zap />} value="$0.00" label={`${summary?.skills.enabled ?? 0} enabled skills`} barColor="var(--accent-2)" iconBg="rgba(0,212,255,0.12)" iconColor="var(--accent-2)" />
        <StatCard icon={<Clock />} value={String(summary?.tasks.enabled ?? 0)} label={`Scheduled tasks / next ${nextTask}`} barColor="var(--pink)" iconBg="rgba(236,72,153,0.12)" iconColor="var(--pink)" />
      </div>


      <div className="orch-grid orch-grid-2" style={{ marginBottom: 18 }}>
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">
              <ChevronsRight /> Quick actions
            </div>
          </div>
          <div className="orch-card-body">
            <div className="orch-grid orch-grid-3" style={{ gap: 10 }}>
              <QuickBtn icon={<Users />} label="Add New Agent" onClick={() => openDrawer('agent')} />
              <QuickBtn icon={<Workflow />} label="New Workflow" onClick={() => openDrawer('workflow')} />
              <QuickBtn icon={<Wrench />} label="Install Skill" onClick={() => openDrawer('skill')} />
              <QuickBtn icon={<MessageSquare />} label="New Chat" onClick={() => setActiveView('text')} />
              <QuickBtn icon={<ImageIcon />} label="Generate Image" onClick={() => setActiveView('image')} />
              <QuickBtn icon={<Video />} label="Render Video" onClick={() => setActiveView('video')} />
            </div>
          </div>
        </div>

        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">
              <Activity /> System health
            </div>
            <span className={`orch-chip ${connected === totalRuntimes && totalRuntimes > 0 ? 'green' : 'amber'}`}>
              <span className="orch-dot" />
              {connected}/{totalRuntimes || 0} runtimes
            </span>
          </div>
          <div className="orch-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <HealthRow label="Runtime coverage" value={`${connected}/${totalRuntimes || 0}`} pct={totalRuntimes ? (connected / totalRuntimes) * 100 : 0} fill="fill-cpu" />
              <HealthRow label="Discovered models" value={String(modelCount)} pct={Math.min(100, modelCount * 10)} fill="fill-ram" />
              <HealthRow label="Workflow queue" value={`${summary?.workflows.running ?? 0} running`} pct={summary?.workflows.running ? 35 : 3} fill="fill-vram" />
              <HealthRow label={executionMode === 'local' ? 'Mode / Local' : 'Mode / Cloud'} value={executionMode} pct={executionMode === 'local' ? 100 : 50} fill="fill-gpu" icon={executionMode === 'local' ? <Cpu /> : <Cloud />} />
            </div>
          </div>
        </div>
      </div>
      <div className="orch-grid orch-grid-2-1" style={{ marginBottom: 18 }}>
        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">
              <Workflow /> Active workflow runs
            </div>
            <button className="orch-btn ghost xs" onClick={() => setActiveView('workflows')}>
              View all
            </button>
          </div>
          <div className="orch-list">
            {recentRuns.length > 0 ? (
              recentRuns.map((run) => (
                <div className="orch-row" key={run.id}>
                  <div className="orch-row-icon" style={{ background: 'rgba(124,92,255,0.15)', color: 'var(--accent)' }}>
                    <PlayCircle />
                  </div>
                  <div className="orch-row-main">
                    <div className="orch-row-title">
                      {run.workflowName}
                      <span className={`orch-chip ${run.status === 'failed' ? 'red' : run.status === 'completed' ? 'green' : 'amber'}`}>
                        <span className={`orch-dot${run.status === 'running' ? ' pulse' : ''}`} />
                        {run.status}
                      </span>
                    </div>
                    <div className="orch-row-sub">Triggered by {run.trigger}</div>
                  </div>
                  <div className="orch-row-meta">{relativeTime(run.startedAt)}</div>
                </div>
              ))
            ) : (
              <EmptyState title="No workflow runs yet." subtitle="Run a workflow to start collecting history." />
            )}
          </div>
        </div>

        <div className="orch-card">
          <div className="orch-card-header">
            <div className="orch-card-title">
              <Activity /> Live activity
            </div>
            <button className="orch-btn ghost xs" onClick={() => setActiveView('activity')}>
              Open
            </button>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {activity.map((event) => (
              <div className="orch-activity" key={event.id}>
                <div className="orch-activity-dot">
                  {event.tone === 'red' ? <AlertTriangle /> : event.tone === 'green' ? <CheckCircle2 /> : <Zap />}
                </div>
                <div className="orch-activity-content">
                  <strong>{event.title}</strong> {event.message}
                  <div className="orch-activity-time">{relativeTime(event.createdAt)}</div>
                </div>
              </div>
            ))}
            {activity.length === 0 && <EmptyState title="No activity yet." subtitle="Activity will appear here as workflows and runs occur." />}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  barColor,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  barColor: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="orch-stat" style={{ '--bar-color': barColor, '--icon-bg': iconBg, '--icon-color': iconColor } as React.CSSProperties}>
      <div className="orch-stat-row">
        <div className="orch-stat-icon">{icon}</div>
      </div>
      <div className="orch-stat-value">{value}</div>
      <div className="orch-stat-label">{label}</div>
    </div>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="orch-btn" style={{ height: 56, flexDirection: 'column', gap: 4, padding: 8 }}>
      <span style={{ display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function HealthRow({
  label,
  value,
  pct,
  fill,
  icon,
}: {
  label: string;
  value: string;
  pct: number;
  fill: 'fill-cpu' | 'fill-gpu' | 'fill-ram' | 'fill-vram';
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, gap: 8, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      <div className="orch-bar">
        <div className={`fill ${fill}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
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
