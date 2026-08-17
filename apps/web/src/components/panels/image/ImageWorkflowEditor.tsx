import { useEffect, useState } from 'react';
import type { Workflow as WorkflowType, WorkflowNode, WorkflowEdge } from '@lofiaistudio/shared';
import {
  ReactFlow,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  Handle,
  Position,
} from '@xyflow/react';
import { MousePointer, Save, Trash2 } from 'lucide-react';

function ImgNodeComponent({ data, selected }: NodeProps) {
  return (
    <div className={`orch-node${selected ? ' selected' : ''}`} style={{ width: 180, position: 'relative' }}>
      <div className="orch-node-head pink">
        <span style={{ fontSize: 11, opacity: 0.7 }}>🖼</span>
        {data.label as string}
      </div>
      <div className="orch-node-body">{data.nodeType as string}</div>
      <Handle
        type="target"
        position={Position.Left}
        className="orch-node-port in"
        style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="orch-node-port out"
        style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { workflowNode: ImgNodeComponent };

function wfToFlow(wf: WorkflowType): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: wf.nodes.map((n) => ({
      id: n.id,
      type: 'workflowNode',
      position: { x: n.x, y: n.y },
      data: { label: n.label, nodeType: n.type, config: n.config },
    })),
    edges: wf.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.6 },
    })),
  };
}

export function ImageWorkflowEditor({
  workflow,
  onSave,
}: {
  workflow: WorkflowType;
  onSave: (collection: string, id: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { nodes: initNodes, edges: initEdges } = wfToFlow(workflow);
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [_rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { nodes: n, edges: e } = wfToFlow(workflow);
    setNodes(n);
    setEdges(e);
    setSelectedNode(null);
  }, [workflow.id, setNodes, setEdges]);

  const onConnect = (params: Connection) => setEdges((eds) => addEdge(
    { ...params, type: 'smoothstep', style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.6 } }, eds,
  ));

  const handleSave = async () => {
    setSaving(true);
    const updatedNodes: WorkflowNode[] = nodes.map((n) => ({
      id: n.id,
      type: (n.data.nodeType as string) as WorkflowNode['type'],
      label: n.data.label as string,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      config: (n.data.config as Record<string, unknown>) ?? {},
    }));
    const updatedEdges: WorkflowEdge[] = edges.map((e) => ({ id: e.id, from: e.source, to: e.target }));
    try {
      await onSave('workflows' as never, workflow.id, { nodes: updatedNodes, edges: updatedEdges } as Record<string, unknown>);
    } catch {}
    setSaving(false);
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => setSelectedNode(node);
  const onPaneClick = () => setSelectedNode(null);
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  return (
    <div>
      <div className="orch-wf-toolbar" style={{ zIndex: 10 }}>
        <button className="orch-icon-btn" title="Select"><MousePointer size={14} /></button>
        <button className="orch-icon-btn" title="Delete selected" onClick={deleteSelectedNode} disabled={!selectedNode}><Trash2 size={14} /></button>
        <button className="orch-icon-btn" title="Save" onClick={handleSave} disabled={saving}><Save size={14} /></button>
      </div>
      <div style={{ height: 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          snapToGrid
          snapGrid={[20, 20]}
        >
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeColor="var(--border-strong)"
            nodeColor="var(--bg-4)"
            maskColor="rgba(0,0,0,0.35)"
            style={{ border: '1px solid var(--border-c)', borderRadius: 6 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
