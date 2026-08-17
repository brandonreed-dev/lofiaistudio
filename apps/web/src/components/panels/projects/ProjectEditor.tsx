import React from 'react';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { Project, ProjectNode, ProjectEdge } from '@lofiaistudio/shared';
import {
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import { ProjectEditorPanel } from './ProjectEditorPanel';

export function ProjectEditor({ project, onSelect }: { project: Project; onSelect?: (id: string) => void }) {
  const { projects, updateEntity, pushToast } = useOrchestrationStore();

  const handleSave = React.useCallback(async (_project: Project, _nodes: Node[], _edges: Edge[]) => {
    const projectNodes: ProjectNode[] = _nodes.map((n) => ({
      id: n.id,
      type: (n.data.nodeType as ProjectNode['type']),
      label: n.data.label as string,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      parentId: n.data.parentId as string | undefined,
      config: (n.data.config as Record<string, unknown>) ?? {},
    }));
    const projectEdges: ProjectEdge[] = _edges.map((e) => ({ id: e.id, from: e.source, to: e.target }));
    await updateEntity('projects', project.id, { nodes: projectNodes, edges: projectEdges } as Partial<Project>);
    pushToast('Project saved');
  }, [project.id, updateEntity, pushToast]);

  const handleSelect = React.useCallback((id: string) => {
    onSelect?.(id);
  }, [onSelect]);

  return (
    <ReactFlowProvider>
      <ProjectEditorPanel
        project={project}
        projects={projects}
        onSelect={handleSelect}
        onSave={handleSave}
        saving={false}
      />
    </ReactFlowProvider>
  );
}
