import { create } from 'zustand';
import type {
  ActivityEvent,
  Agent,
  DashboardSummary,
  Integration,
  Project,
  Skill,
  TaskSchedule,
  User,
  Workflow,
  WorkflowRun,
} from '@lofiaistudio/shared';
import { api } from '@/lib/api';

type CollectionName =
  | 'agents'
  | 'workflows'
  | 'skills'
  | 'tasks'
  | 'projects'
  | 'integrations'
  | 'users';

type EntityMap = {
  agents: Agent;
  workflows: Workflow;
  skills: Skill;
  tasks: TaskSchedule;
  projects: Project;
  integrations: Integration;
  users: User;
};

export type DrawerKind =
  | 'agent'
  | 'workflow'
  | 'skill'
  | 'task'
  | 'project'
  | 'integration'
  | 'quick-create'
  | null;

export interface Toast {
  id: string;
  message: string;
}

interface OrchestrationState {
  agents: Agent[];
  workflows: Workflow[];
  workflowRuns: WorkflowRun[];
  skills: Skill[];
  tasks: TaskSchedule[];
  projects: Project[];
  integrations: Integration[];
  users: User[];
  activity: ActivityEvent[];
  summary: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
  drawerKind: DrawerKind;
  drawerEntityId: string | null;
  commandOpen: boolean;
  agentChatOpen: boolean;
  selectedAgentChatId: string | null;
  toasts: Toast[];

  loadAll: () => Promise<void>;
  loadSummary: () => Promise<void>;
  loadFilteredActivity: (params: Record<string, string | undefined>) => Promise<ActivityEvent[]>;
  exportFilteredActivity: (params: Record<string, string | undefined>, format: 'csv' | 'json') => Promise<void>;
  loadCollection: <K extends CollectionName>(collection: K) => Promise<EntityMap[K][]>;
  createEntity: <K extends CollectionName>(collection: K, payload: Partial<EntityMap[K]>) => Promise<EntityMap[K]>;
  updateEntity: <K extends CollectionName>(
    collection: K,
    id: string,
    payload: Partial<EntityMap[K]>
  ) => Promise<EntityMap[K]>;
  deleteEntity: <K extends CollectionName>(collection: K, id: string) => Promise<void>;
  runWorkflow: (id: string) => Promise<WorkflowRun>;
  runTask: (id: string) => Promise<WorkflowRun>;
  openDrawer: (kind: DrawerKind, entityId?: string | null) => void;
  closeDrawer: () => void;
  setCommandOpen: (open: boolean) => void;
  setAgentChatOpen: (open: boolean) => void;
  setSelectedAgentChatId: (id: string | null) => void;
  pushToast: (message: string) => void;
  dismissToast: (id: string) => void;
}

export const useOrchestrationStore = create<OrchestrationState>((set, get) => ({
  agents: [],
  workflows: [],
  workflowRuns: [],
  skills: [],
  tasks: [],
  projects: [],
  integrations: [],
  users: [],
  activity: [],
  summary: null,
  isLoading: false,
  error: null,
  drawerKind: null,
  drawerEntityId: null,
  commandOpen: false,
  agentChatOpen: false,
  selectedAgentChatId: null,
  toasts: [],

  loadFilteredActivity: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      const activity = await api<ActivityEvent[]>(`/api/activity?${query.toString()}`);
      set({ activity, isLoading: false });
      return activity;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load activity', isLoading: false });
      return [];
    }
  },

  exportFilteredActivity: async (params, format) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const activity = await api<ActivityEvent[]>(`/api/activity?${query.toString()}`);
    const blob = new Blob(
      [
        format === 'json'
          ? JSON.stringify(activity, null, 2)
          : [
              'id,type,title,message,tone,projectId,userId,workspaceId,createdAt,costAmount,costCurrency,flagKey,flagVariation',
              ...activity.map((e) =>
                [
                  e.id,
                  e.type,
                  (e.title ?? '').replace(/\n/g, ' '),
                  (e.message ?? '').replace(/\n/g, ' '),
                  e.tone,
                  e.projectId ?? '',
                  e.userId ?? '',
                  e.workspaceId ?? '',
                  e.createdAt ?? '',
                  e.cost?.amount ?? '',
                  e.cost?.currency ?? 'USD',
                  e.flagKey ?? '',
                  e.flagVariation ?? '',
                ].join(',')
              ),
            ].join('\n'),
      ],
      { type: format === 'json' ? 'application/json' : 'text/csv' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-export-${new Date().toISOString()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [
        agents,
        workflows,
        workflowRuns,
        skills,
        tasks,
        projects,
        integrations,
        activity,
        summary,
      ] = await Promise.all([
        api<Agent[]>('/api/agents'),
        api<Workflow[]>('/api/workflows'),
        api<WorkflowRun[]>('/api/workflow-runs'),
        api<Skill[]>('/api/skills'),
        api<TaskSchedule[]>('/api/tasks'),
        api<Project[]>('/api/projects'),
        api<Integration[]>('/api/integrations'),
        api<ActivityEvent[]>('/api/activity'),
        api<DashboardSummary>('/api/dashboard/summary'),
      ]);
      let users: User[] = [];
      try {
        users = await api<User[]>('/api/users');
      } catch {
        // /api/users may not exist yet; leave users as empty array
      }
      set({
        agents,
        workflows,
        workflowRuns,
        skills,
        tasks,
        projects,
        integrations,
        users,
        activity,
        summary,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load orchestration data', isLoading: false });
    }
  },

  loadSummary: async () => {
    const [summary, activity, workflowRuns] = await Promise.all([
      api<DashboardSummary>('/api/dashboard/summary'),
      api<ActivityEvent[]>('/api/activity'),
      api<WorkflowRun[]>('/api/workflow-runs'),
    ]);
    set({ summary, activity, workflowRuns });
  },

  loadCollection: async (collection) => {
    const data = await api<EntityMap[typeof collection][]>(`/api/${collection}`);
    set({ [collection]: data } as unknown as Pick<OrchestrationState, typeof collection>);
    return data;
  },

  createEntity: async (collection, payload) => {
    const entity = await api<EntityMap[typeof collection]>(`/api/${collection}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await get().loadAll();
    get().pushToast('Created successfully');
    return entity;
  },

  updateEntity: async (collection, id, payload) => {
    const entity = await api<EntityMap[typeof collection]>(`/api/${collection}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await get().loadAll();
    get().pushToast('Saved changes');
    return entity;
  },

  deleteEntity: async (collection, id) => {
    await api<boolean>(`/api/${collection}/${id}`, { method: 'DELETE' });
    await get().loadAll();
    get().pushToast('Deleted');
  },

  runWorkflow: async (id) => {
    const run = await api<WorkflowRun>(`/api/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ trigger: 'manual' }),
    });
    await get().loadAll();
    get().pushToast(`${run.workflowName} ${run.status}`);
    // Display any toast messages collected during workflow execution
    if (run.toastMessages && run.toastMessages.length > 0) {
      for (const toast of run.toastMessages) {
        get().pushToast(toast);
      }
    }
    return run;
  },

  runTask: async (id) => {
    const run = await api<WorkflowRun>(`/api/tasks/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await get().loadAll();
    get().pushToast(`${run.workflowName} ${run.status}`);
    return run;
  },

  openDrawer: (kind, entityId = null) => set({ drawerKind: kind, drawerEntityId: entityId }),
  closeDrawer: () => set({ drawerKind: null, drawerEntityId: null }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setAgentChatOpen: (open) => set({ agentChatOpen: open }),
  setSelectedAgentChatId: (id) => set({ selectedAgentChatId: id }),

  pushToast: (message) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message }] }));
    window.setTimeout(() => get().dismissToast(id), 2600);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
