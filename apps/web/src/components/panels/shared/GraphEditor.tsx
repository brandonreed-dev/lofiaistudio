import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type NodeTypes,
  type ReactFlowInstance,
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export type GraphNodeType = {
  type: string;
  label: string;
  category: 'input' | 'model' | 'skill' | 'output' | 'logic' | 'environment' | 'container' | 'resource' | 'compute';
  icon?: string;
  color?: string;
  fields?: Array<{ key: string; label: string; type: 'text' | 'number' | 'select' | 'secret-ref'; options?: string[] }>;
};

export type GraphEditorProps<TNode extends Node, TEdge extends Edge> = {
  title: string;
  nodes: TNode[];
  edges: TEdge[];
  onNodesChange: React.Dispatch<React.SetStateAction<TNode[]>>;
  onEdgesChange: React.Dispatch<React.SetStateAction<TEdge[]>>;
  nodeTypes: NodeTypes;
  paletteSections: Array<{ title: string; items: GraphNodeType[] }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSave: () => Promise<void>;
  onExport: () => void;
  saving: boolean;
  validateConnection?: (connection: Connection, nodes: TNode[]) => string | null;
};

export function GraphEditor<TNode extends Node, TEdge extends Edge>({
  title,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  nodeTypes,
  paletteSections,
  selectedId,
  onSelect,
  onSave,
  onExport,
  saving,
  validateConnection,
}: GraphEditorProps<TNode, TEdge>) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      const error = validateConnection?.(params, nodes as TNode[]);
      if (error) {
        console.warn('Connection blocked:', error);
        return;
      }
      const edge = {
        ...params,
        animated: false,
        style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.6 },
      } as unknown as TEdge;
      onEdgesChange((eds) => [...eds, edge]);
    },
    [nodes, onEdgesChange, validateConnection]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onSelect(node.id ?? '');
  }, [onSelect]);

  const onPaneClick = useCallback(() => {
    onSelect('');
  }, [onSelect]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const typeStr = event.dataTransfer.getData('application/reactflow');
      if (!typeStr || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const [nodeType, label] = typeStr.split('::');
      const newNode: Node = {
        id: `node-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 9)}`,
        type: 'graphNode',
        position,
        data: { label, nodeType, config: {} },
      };
      onNodesChange((nds) => nds.concat(newNode as TNode));
    },
    [reactFlowInstance, onNodesChange]
  );

  return (
    <div className="orch-grid" style={{ gridTemplateColumns: '220px 1fr 280px', gap: 14 }}>
      <div className="orch-card" style={{ height: 'fit-content' }}>
        <div className="orch-card-header"><div className="orch-card-title">Node palette</div></div>
        <div style={{ padding: 8 }}>
          <select className="orch-select" style={{ marginBottom: 8 }} disabled>
            <option>{title}</option>
          </select>
          {paletteSections.map((section) => (
            <div key={section.title} style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', padding: '8px 4px 4px' }}>
              {section.title}
            </div>
          ))}
        </div>
      </div>

      <div className="orch-card" style={{ overflow: 'hidden' }}>
        <div className="orch-wf-toolbar" style={{ zIndex: 10 }}>
          <span className="orch-card-title">{title}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="orch-btn" onClick={onExport}><span style={{ fontSize: 12 }}>Export</span></button>
            <button className="orch-btn primary" onClick={onSave} disabled={saving}><span style={{ fontSize: 12 }}>Save</span></button>
          </div>
        </div>
        <div ref={reactFlowWrapper} style={{ height: 500 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as any}
            onEdgesChange={onEdgesChange as any}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Control"
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

      <Inspector selectedId={selectedId} nodes={nodes} onNodesChange={onNodesChange} />
    </div>
  );
}

function Inspector<TNode extends Node>({ selectedId, nodes, onNodesChange }: { selectedId: string | null; nodes: TNode[]; onNodesChange: React.Dispatch<React.SetStateAction<TNode[]>> }) {
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const updateNodeData = useCallback((key: string, value: unknown) => {
    if (!selected) return;
    onNodesChange((nds) =>
      (nds as Node[]).map((n) =>
        n.id === selected.id
          ? { ...n, data: { ...(n.data as Record<string, unknown>), [key]: value } }
          : n
      ) as TNode[]
    );
  }, [selected, onNodesChange]);

  if (!selected) {
    return (
      <div className="orch-card" style={{ height: 'fit-content' }}>
        <div className="orch-card-header"><div className="orch-card-title">Inspector</div></div>
        <div className="orch-card-body" style={{ color: 'var(--text-2)', fontSize: 13, textAlign: 'center', padding: 16 }}>
          Select a node to inspect its properties
        </div>
      </div>
    );
  }

  const data = selected.data as Record<string, unknown>;
  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
      <div className="orch-card-header"><div className="orch-card-title">Inspector</div></div>
      <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Label</label>
          <input className="orch-input" value={(data.label as string) ?? ''} onChange={(e) => updateNodeData('label', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Type</label>
          <input className="orch-input" value={(data.nodeType as string) ?? ''} readOnly />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Config (JSON)</label>
          <textarea
            className="orch-textarea"
            rows={10}
            value={JSON.stringify((data.config as Record<string, unknown>) ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateNodeData('config', parsed);
              } catch { /* ignore invalid JSON */ }
            }}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
          />
        </div>
      </div>
    </div>
  );
}