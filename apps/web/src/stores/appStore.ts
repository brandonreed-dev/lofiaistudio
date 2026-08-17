import { create } from 'zustand';
import type { Modality, ExecutionMode } from '@lofiaistudio/shared';

// View extends Modality with the orchestration-level workspace views.
export type View =
  | 'dashboard'
  | 'agents'
  | 'workflows'
  | 'skills'
  | 'tasks'
  | 'servers'
  | 'models'
  | 'storage'
  | 'projects'
  | 'project-editor'
  | 'organizations'
  | 'users'
  | 'roles'
  | 'integrations'
  | 'activity'
  | 'license'
  | 'settings'
  | 'code'
  | 'inbox'
  | 'reports'
  | 'plugins'
  | 'chat'
  | 'posts'
  | 'issues'
  | Modality;

export const VIEW_LABELS: Record<View, string> = {
  dashboard: 'Dashboard',
  chat: 'Chat',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  '3d': '3D Models',
  text: 'Text',
  agents: 'Agents',
  workflows: 'Workflows',
  skills: 'Skills',
  tasks: 'Tasks & Jobs',
  servers: 'Servers',
  models: 'Models',
  storage: 'Storage',
  projects: 'Projects',
  'project-editor': 'Project Editor',
  organizations: 'Organizations',
  users: 'Users',
  roles: 'Roles',
  integrations: 'Integrations',
  activity: 'Activity',
  license: 'License',
  settings: 'Settings',
  code: 'Code',
  inbox: 'Inbox',
  reports: 'Reports',
  plugins: 'Plugins',
  posts: 'Posts',
  issues: 'Issues'
};

const MODALITY_VIEWS: Modality[] = ['text', 'image', 'audio', 'video', '3d'];

function isModalityView(view: View): view is Modality {
  return (MODALITY_VIEWS as string[]).includes(view);
}

interface AppState {
  activeView: View;
  setActiveView: (view: View) => void;
  activeModality: Modality;
  setActiveModality: (modality: Modality) => void;
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
  activeCloudProvider: string | null;
  setActiveCloudProvider: (provider: string | null) => void;
  showCloudConfirmation: boolean;
  setShowCloudConfirmation: (show: boolean) => void;
  pendingCloudSwitch: boolean;
  setPendingCloudSwitch: (pending: boolean) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (view) =>
    set(
      isModalityView(view)
        ? { activeView: view, activeModality: view }
        : { activeView: view }
    ),

  activeModality: 'text',
  setActiveModality: (modality) =>
    set({ activeModality: modality, activeView: modality }),

  executionMode: 'local',
  setExecutionMode: (mode) => set({ executionMode: mode }),

  activeCloudProvider: null,
  setActiveCloudProvider: (provider) => set({ activeCloudProvider: provider }),

  showCloudConfirmation: false,
  setShowCloudConfirmation: (show) => set({ showCloudConfirmation: show }),
  pendingCloudSwitch: false,
  setPendingCloudSwitch: (pending) => set({ pendingCloudSwitch: pending }),

  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));