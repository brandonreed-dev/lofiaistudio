import { lazy, Suspense, useEffect, useCallback } from 'react';
import { useAppStore, useModelStore } from '@/stores';
import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const DashboardPanel = lazy(() => import('./components/panels/dashboard/DashboardPanel').then((m) => ({ default: m.DashboardPanel })));
const TextPanel = lazy(() => import('./components/panels/chat/TextPanel').then((m) => ({ default: m.TextPanel })));
const ImagePanel = lazy(() => import('./components/panels/image/ImagePanel').then((m) => ({ default: m.ImagePanel })));
const AudioPanel = lazy(() => import('./components/panels/audio/AudioPanel').then((m) => ({ default: m.AudioPanel })));
const VideoPanel = lazy(() => import('./components/panels/video/VideoPanel').then((m) => ({ default: m.VideoPanel })));
const Model3DPanel = lazy(() => import('./components/panels/model3d/Model3DPanel').then((m) => ({ default: m.Model3DPanel })));
const InboxPanel = lazy(() => import('./components/panels/inbox/InboxPanel').then((m) => ({ default: m.InboxPanel })));
const UsersPanel = lazy(() => import('./components/panels/users/UsersPanel').then((m) => ({ default: m.UsersPanel })));
const AgentsPanel = lazy(() => import('./components/panels/agents/AgentsPanel').then((m) => ({ default: m.AgentsPanel })));
const WorkflowsPanel = lazy(() => import('./components/panels/workflows/WorkflowsPanel').then((m) => ({ default: m.WorkflowsPanel })));
const SkillsPanel = lazy(() => import('./components/panels/skills/SkillsPanel').then((m) => ({ default: m.SkillsPanel })));
const TasksPanel = lazy(() => import('./components/panels/tasks/TasksPanel').then((m) => ({ default: m.TasksPanel })));
const OrchestrationPanel = lazy(() => import('./components/panels/OrchestrationPanel').then((m) => ({ default: m.OrchestrationPanel })));
const StoragePanel = lazy(() => import('./components/panels/storage/StoragePanel').then((m) => ({ default: m.StoragePanel })));
const CodePanel = lazy(() => import('./components/panels/code/CodePanel').then((m) => ({ default: m.CodePanel })));
const ServersPanel = lazy(() => import('./components/panels/servers/ServersPanel').then((m) => ({ default: m.ServersPanel })));
const SettingsPanel = lazy(() => import('./components/panels/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const ModelsPanel = lazy(() => import('./components/panels/models/ModelsPanel').then((m) => ({ default: m.ModelsPanel })));

function PanelLoading() {
  return <div className="orch-panel">Loading...</div>;
}
function App() {
  const { activeView, activeModality } = useAppStore();
  const { fetchModels } = useModelStore();

  const handleFetchModels = useCallback(() => {
    if (
      activeView === 'text' ||
      activeView === 'image' ||
      activeView === 'audio' ||
      activeView === 'video' ||
      activeView === '3d'
    ) {
      fetchModels(activeModality);
    }
  }, [activeView, activeModality, fetchModels]);

  useEffect(() => {
    handleFetchModels();
  }, [handleFetchModels]);

  const renderPanel = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardPanel />;
      case 'text':
        return <TextPanel />;
      case 'image':
        return <ImagePanel />;
      case 'audio':
        return <AudioPanel />;
      case 'video':
        return <VideoPanel />;
      case '3d':
        return <Model3DPanel />;
      case 'inbox':
        return <InboxPanel />;
      case 'organizations':
      case 'users':
        return <UsersPanel />;
      case 'roles':
        return <UsersPanel />;
      case 'agents':
        return <AgentsPanel />;
      case 'workflows':
        return <WorkflowsPanel />;
      case 'skills':
        return <SkillsPanel />;
      case 'tasks':
        return <TasksPanel />;
      case 'storage':
        return <StoragePanel />;
      case 'code':
        return <CodePanel />;
      case 'projects':
      case 'project-editor':
      case 'servers':
      case 'models':
      case 'integrations':
      case 'activity':
      case 'license':
      case 'reports':
      case 'issues':
      case 'posts':
      case 'plugins':
      case 'settings':
        return <OrchestrationPanel view={activeView} />;
      default:
        return <DashboardPanel />;
    }
  };

  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PanelLoading />}>{renderPanel()}</Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
