import { useEffect, useState } from 'react';
import { Bell, Bot, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { useAppStore, useRuntimeStore, VIEW_LABELS } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';
import { ChatBox, type ChatParticipant } from '@/components/ChatBox';
import { cn } from '@/lib/utils';
import { CommandPalette } from './layout/CommandPalette';
import { QuickDrawer } from './layout/QuickDrawer';
import { CheckMark } from './layout/CheckMark';
import { NAV, breadcrumbGroupFor } from './layout/navigation';
import { ResourceRow } from './layout/ResourceRow';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { activeView, setActiveView, executionMode } = useAppStore();
  const { runtimes, connectRuntimes } = useRuntimeStore();
  const {
    agents,
    workflows,
    skills,
    tasks,
    loadAll,
    setCommandOpen,
    agentChatOpen: chatOpen,
    setAgentChatOpen: setChatOpen,
    selectedAgentChatId,
    setSelectedAgentChatId,
    toasts,
    dismissToast,
    openDrawer,
  } = useOrchestrationStore();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useAppStore();
  const [resources, setResources] = useState({ cpu: 38, gpu: 71, ram: 52, vram: 84 });

  useEffect(() => {
    connectRuntimes();
    loadAll();
  }, [connectRuntimes, loadAll]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // system
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) root.classList.add('dark');
        else root.classList.remove('dark');
      }
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    const id = setInterval(() => {
      const j = (b: number, r: number) => Math.max(2, Math.min(98, b + (Math.random() - 0.5) * r));
      setResources({
        cpu: Math.round(j(38, 12)),
        gpu: Math.round(j(71, 18)),
        ram: Math.round(j(52, 8)),
        vram: Math.round(j(84, 6)),
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCommandOpen]);

  const connectedCount = runtimes.filter((r) => r.connected).length;
  const badgeFor = (view: string, fallback?: string) => {
    if (view === 'agents') return String(agents.length);
    if (view === 'workflows') return String(workflows.length);
    if (view === 'skills') return String(skills.length);
    if (view === 'tasks') return String(tasks.length);
    return fallback;
  };

  const breadcrumbGroup = breadcrumbGroupFor(activeView);
  const selectedChatAgent = selectedAgentChatId
    ? agents.find((agent) => agent.id === selectedAgentChatId) ?? null
    : null;
  const defaultAgent = agents.find((agent) => agent.id === 'agent-jayne') ?? agents[0] ?? null;
  const chatParticipant: ChatParticipant | null = selectedChatAgent ?? defaultAgent
    ? {
        kind: 'agent',
        id: (selectedChatAgent ?? defaultAgent)!.id,
        agentId: (selectedChatAgent ?? defaultAgent)!.id,
        name: (selectedChatAgent ?? defaultAgent)!.name,
        role: (selectedChatAgent ?? defaultAgent)!.role,
        avatar: (selectedChatAgent ?? defaultAgent)!.avatar,
        avatarImageUrl: (selectedChatAgent ?? defaultAgent)!.avatarImageUrl,
        colorA: (selectedChatAgent ?? defaultAgent)!.colorA,
        colorB: (selectedChatAgent ?? defaultAgent)!.colorB,
        model: (selectedChatAgent ?? defaultAgent)!.model,
        systemPrompt: (selectedChatAgent ?? defaultAgent)!.systemPrompt,
        greeting: (selectedChatAgent ?? defaultAgent)!.greeting ?? `Hi, I am ${(selectedChatAgent ?? defaultAgent)!.name}. I can help you get started with LoFi AI Studio.`,
      }
    : null;

  return (
    <div className={cn('orch-app', collapsed && 'collapsed')}>
      <aside className="orch-sidebar">
        <div className="orch-sidebar-header">
          <div className="orch-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="orch-brand">
            <span className="name">LoFi AI Studio</span>
            <span className="tag">Local First AI Omnitool</span>
          </div>
        </div>
        
        <button 
          className="orch-ws" 
          // onClick={() => setActiveView('users')}
        >
          <div className="orch-ws-avatar">B</div>
          <div className="orch-ws-info">
            <div className="ws-name" style={{ textAlign: 'left' }}>Brandon's Studio</div>
            <div className="ws-mode">{executionMode === 'local' ? 'Local Only' : 'Cloud Enabled'}</div>
          </div>
        </button>

        <nav className="orch-nav">
          {NAV.map((group) => (
            <div className="orch-nav-section" key={group.title}>
              <div className="orch-nav-section-title">{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge = badgeFor(item.view, item.badge);
                return (
                  <button
                    key={item.view}
                    className={cn('orch-nav-item', activeView === item.view && 'active')}
                    onClick={() => setActiveView(item.view)}
                  >
                    <Icon />
                    <span>{VIEW_LABELS[item.view]}</span>
                    {badge && <span className="badge">{badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

      </aside>

      <header className="orch-topbar">
        <div className="orch-topbar-left">
          <button className="orch-icon-btn" onClick={() => setCollapsed((c) => !c)} title="Toggle sidebar">
            <Menu />
          </button>
          <div className="orch-crumbs">
            <span>{breadcrumbGroup}</span>
            <span className="sep">/</span>
            <span className="current">{VIEW_LABELS[activeView]}</span>
          </div>
        </div>

        <div className="orch-search">
          <Search />
          <input type="text" placeholder="Search agents, skills, workflows, models..." onFocus={() => setCommandOpen(true)} />
          <span className="orch-kbd">Ctrl K</span>
        </div>

        <div className="orch-topbar-actions">
          <button className="orch-btn ghost sm" title="Toggle theme" onClick={() => {
            const effective = theme === 'system'
              ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
              : theme;
            setTheme(effective === 'dark' ? 'light' : 'dark');
          }}>
            {(() => {
              const effective = theme === 'system'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : theme;
              return effective === 'dark' ? <Sun /> : <Moon />;
            })()}
          </button>
          <button className="orch-icon-btn" title="Notifications" onClick={() => setActiveView('activity')}>
            <Bell />
            <span className="orch-notif-dot" />
          </button>
          <button className="orch-btn primary sm" onClick={() => openDrawer('quick-create')}>
            <Plus />
            Create
          </button>
        </div>
      </header>

      <main className="orch-main">{children}</main>
      <CommandPalette />
      <QuickDrawer />
      <ChatBox isOpen={chatOpen} participant={chatParticipant} onClose={() => setChatOpen(false)} />
      <button
        className={cn('orch-fab', chatOpen && 'open')}
        title="Open chat"
        onClick={() => {
          if (chatOpen) {
            setChatOpen(false);
            return;
          }
          setSelectedAgentChatId(null);
          setChatOpen(true);
        }}
      >
        <Bot />
      </button>
      <div className="orch-toasts">
        {toasts.map((toast) => (
          <button className="orch-toast" key={toast.id} onClick={() => dismissToast(toast.id)}>
            <CheckMark />
            <span>{toast.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
