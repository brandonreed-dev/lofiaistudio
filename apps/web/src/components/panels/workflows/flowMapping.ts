import type { Edge, Node } from '@xyflow/react';
import type { Workflow as WorkflowType, WorkflowEdge, WorkflowNode } from '@lofiaistudio/shared';

export function workflowToFlow(workflow: WorkflowType): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: 'workflowNode',
    position: { x: n.x, y: n.y },
    data: { label: n.label, nodeType: n.type, config: n.config },
  }));
  const edges: Edge[] = workflow.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    animated: false,
    style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.6 },
  }));
  return { nodes, edges };
}

export function flowToWorkflow(
  workflow: WorkflowType,
  flowNodes: Node[],
  flowEdges: Edge[],
): WorkflowType {
  const nodes: WorkflowNode[] = flowNodes.map((n) => ({
    id: n.id,
    type: (n.data.nodeType as string) as WorkflowNode['type'],
    label: n.data.label as string,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    config: (n.data.config as Record<string, unknown>) ?? {},
  }));
  const edges: WorkflowEdge[] = flowEdges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
  }));
  return { ...workflow, nodes, edges };
}
