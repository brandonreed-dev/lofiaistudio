import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { Project, ProjectNode, ProjectNodeType, ProjectEdge, RuntimeStatus } from '@lofiaistudio/shared';
import type { EnvironmentConfig, ContainerConfig, RepoConfig, DatabaseConfig, VectorStoreConfig, ServiceConfig, WorkflowRefConfig, AgentRefConfig, DeploymentConfig, EndpointConfig, SecretsConfig } from '@lofiaistudio/shared';
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
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react';
// import '@xyflow/react/dist/style.css';
import {
  Activity,
  Box,
  Cpu,
  Database,
  Download,
  FolderGit2,
  Globe,
  Layers,
  Lock,
  Maximize2,
  Play,
  Plus,
  Route,
  Save,
  Server,
  Trash2,
  Users,
  Workflow,
  Zap,
  MousePointer,
} from 'lucide-react';

// ─── Environment Colors ────────────────────────────────────────────────────────

const ENV_COLORS: Record<string, string> = {
  'environment.dev': '#28a745',
  'environment.staging': '#ffc658',
  'environment.prod': '#dc3545',
};

// ─── Palette Config ────────────────────────────────────────────────────────────

interface PaletteItem {
  type: ProjectNodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Environments
  { type: 'environment.dev', label: 'Dev Environment', icon: <Layers size={13} />, color: '#28a745', category: 'Environments' },
  { type: 'environment.staging', label: 'Staging Environment', icon: <Layers size={13} />, color: '#ffc658', category: 'Environments' },
  { type: 'environment.prod', label: 'Prod Environment', icon: <Layers size={13} />, color: '#dc3545', category: 'Environments' },
  // Containers
  { type: 'container.data', label: 'Data Container', icon: <Database size={13} />, color: '#6f42c1', category: 'Containers' },
  { type: 'container.compute', label: 'Compute Container', icon: <Box size={13} />, color: '#6f42c1', category: 'Containers' },
  // Resources
  { type: 'repo', label: 'Repository', icon: <FolderGit2 size={13} />, color: '#0dcaf0', category: 'Resources' },
  { type: 'database', label: 'Database', icon: <Database size={13} />, color: '#0dcaf0', category: 'Resources' },
  { type: 'vector.store', label: 'Vector Store', icon: <Layers size={13} />, color: '#0dcaf0', category: 'Resources' },
  { type: 'secrets', label: 'Secrets / Vault', icon: <Lock size={13} />, color: '#0dcaf0', category: 'Resources' },
  // Compute
  { type: 'service', label: 'Service', icon: <Server size={13} />, color: '#e83e8c', category: 'Compute' },
  { type: 'workflow.ref', label: 'Workflow Ref', icon: <Workflow size={13} />, color: '#e83e8c', category: 'Compute' },
  { type: 'agent.ref', label: 'Agent Ref', icon: <Users size={13} />, color: '#e83e8c', category: 'Compute' },
  // Network
  { type: 'endpoint', label: 'Endpoint', icon: <Globe size={13} />, color: '#20c997', category: 'Network' },
  { type: 'deployment', label: 'Deployment', icon: <Zap size={13} />, color: '#20c997', category: 'Network' },
];

const PALETTE_CATEGORIES = ['Environments', 'Containers', 'Resources', 'Compute', 'Network'];

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── React Flow Node Component ────────────────────────────────────────────────

function ProjectNodeComponent({ data, selected }: NodeProps) {
  const nodeType = data.nodeType as ProjectNodeType | undefined;
  const baseColor = nodeType ? (ENV_COLORS[nodeType] ?? 'var(--bg-4)') : 'var(--bg-4)';
  const isEnvironment = nodeType?.startsWith('environment') ?? false;
  const isContainer = nodeType?.startsWith('container') ?? false;

  return (
    <div
      className={`orch-node${selected ? ' selected' : ''}`}
      style={{
        width: isEnvironment ? 260 : 180,
        minHeight: isEnvironment ? 120 : 40,
        background: baseColor,
        color: '#fff',
        borderRadius: isEnvironment ? 16 : isContainer ? 10 : 8,
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      {!isEnvironment && (
        <Handle type="target" position={Position.Left} className="orch-node-port in" style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)' }} />
      )}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>{nodeType}</div>
        <div style={{ fontWeight: 600 }}>{data.label as string}</div>
      </div>
      {!isEnvironment && (
        <Handle type="source" position={Position.Right} className="orch-node-port out" style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      )}
    </div>
  );
}

const projectNodeTypes: NodeTypes = { projectNode: ProjectNodeComponent };

// ─── Flow Conversions ────────────────────────────────────────────────────────

function projectNodeToFlow(node: ProjectNode): Node {
  return {
    id: node.id,
    type: 'projectNode',
    position: { x: node.x, y: node.y },
    data: { label: node.label, nodeType: node.type, config: node.config, parentId: node.parentId },
    style: {
      width: 180,
      background: ENV_COLORS[node.type] ?? 'var(--bg-4)',
      color: '#fff',
      border: '1px solid var(--border-strong)',
      borderRadius: node.type.startsWith('environment') ? 16 : 8,
    },
  };
}

function flowToProjectNode(flowNode: Node): ProjectNode {
  return {
    id: flowNode.id,
    type: (flowNode.data.nodeType as ProjectNode['type']),
    label: flowNode.data.label as string,
    x: Math.round(flowNode.position.x),
    y: Math.round(flowNode.position.y),
    parentId: flowNode.data.parentId as string | undefined,
    config: (flowNode.data.config as Record<string, unknown>) ?? {},
  };
}

// ─── Editor ──────────────────────────────────────────────────────────────────

interface ProjectEditorPanelProps {
  project: Project;
  projects: Project[];
  onSelect: (id: string) => void;
  onSave: (project: Project, nodes: Node[], edges: Edge[]) => Promise<void>;
  saving: boolean;
}

export function ProjectEditorPanel({ project, projects, onSelect, onSave, saving }: ProjectEditorPanelProps) {
  const { agents, workflows } = useOrchestrationStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const flowNodes = useMemo(() => (project.nodes ?? []).map(projectNodeToFlow), [project.id, project.nodes]);
  const flowEdges = useMemo(() => (project.edges ?? []).map((e) => ({ id: e.id, source: e.from, target: e.to, type: 'smoothstep' } as Edge)), [project.id, project.edges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const prevProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      setNodes(flowNodes);
      setEdges(flowEdges);
      setSelectedNode(null);
      prevProjectIdRef.current = project.id;
    }
  }, [project.id, flowNodes, flowEdges, setNodes, setEdges]);

  const validateConnection = useCallback((connection: Connection): string | null => {
    const sourceId = connection.source;
    const targetId = connection.target;
    if (!sourceId || !targetId) return 'Invalid connection';

    const source = nodes.find((n) => n.id === sourceId);
    const target = nodes.find((n) => n.id === targetId);
    if (!source || !target) return 'Node not found';

    const sourceType = source.data.nodeType as ProjectNodeType | undefined;
    const targetType = target.data.nodeType as ProjectNodeType | undefined;

    const sourceEnv = sourceType?.startsWith('environment') ? sourceType : (source.data.parentId ? (nodes.find((n) => n.id === source.data.parentId)?.data.nodeType as string | undefined) : undefined);
    const targetEnv = targetType?.startsWith('environment') ? targetType : (target.data.parentId ? (nodes.find((n) => n.id === target.data.parentId)?.data.nodeType as string | undefined) : undefined);

    if (sourceEnv && targetEnv && sourceEnv !== targetEnv) {
      return `Cross-environment connection blocked: ${sourceEnv} → ${targetEnv}`;
    }

    if (sourceType?.startsWith('environment') || targetType?.startsWith('environment')) {
      return 'Environments cannot be directly connected';
    }

    return null;
  }, [nodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      const error = validateConnection(params);
      if (error) {
        console.warn('Connection blocked:', error);
        return;
      }
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'smoothstep', animated: false, style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.6 } },
          eds,
        ),
      );
    },
    [setEdges, validateConnection],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const typeStr = event.dataTransfer.getData('application/reactflow');
      if (!typeStr || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const [nodeType, label] = typeStr.split('::');
      const newNode: Node = {
        id: generateId(),
        type: 'projectNode',
        position,
        data: { label, nodeType, config: {} },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    const projectNodes: ProjectNode[] = nodes.map(flowToProjectNode);
    const projectEdges: ProjectEdge[] = edges.map((e) => ({ id: e.id, from: e.source, to: e.target }));
    const updatedProject = { ...project, nodes: projectNodes, edges: projectEdges };
    await onSave(updatedProject, nodes, edges);
  }, [project, nodes, edges, onSave]);

  const handleExport = useCallback(() => {
    const projectNodes: ProjectNode[] = nodes.map(flowToProjectNode);
    const projectEdges: ProjectEdge[] = edges.map((e) => ({ id: e.id, from: e.source, to: e.target }));
    const exportData = { ...project, nodes: projectNodes, edges: projectEdges };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project.name}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }, [nodes, edges, project]);

  // Add Node dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && e.target instanceof Node && !addMenuRef.current.contains(e.target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddMenu]);

  const handleAddNode = (nodeType: string, label: string) => {
    const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
    const pos = lastNode
      ? { x: lastNode.position.x + 220, y: lastNode.position.y }
      : { x: 300, y: 60 };
    const finalPos = pos.x > 700 ? { x: 60, y: pos.y + 100 } : pos;
    const newNode: Node = {
      id: generateId(),
      type: 'projectNode',
      position: finalPos,
      data: { label, nodeType, config: {} },
    };
    setNodes((nds) => nds.concat(newNode));
    setShowAddMenu(false);
  };

  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const sorted = [...nodes].sort((a, b) => {
      const aEnv = (a.data.nodeType as string)?.startsWith('environment') ? 0 : (a.data.nodeType as string)?.startsWith('container') ? 1 : (a.data.nodeType as string)?.startsWith('service') ? 2 : (a.data.nodeType as string)?.startsWith('endpoint') ? 3 : 4;
      const bEnv = (b.data.nodeType as string)?.startsWith('environment') ? 0 : (b.data.nodeType as string)?.startsWith('container') ? 1 : (b.data.nodeType as string)?.startsWith('service') ? 2 : (b.data.nodeType as string)?.startsWith('endpoint') ? 3 : 4;
      return aEnv - bEnv || a.position.x - b.position.x;
    });
    setNodes(sorted.map((n, i) => ({
      ...n,
      position: { x: 40 + Math.floor(i / 6) * 280, y: 40 + (i % 6) * 140 },
    })));
  }, [nodes, setNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if not focused on input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        deleteSelectedNode();
      }
      if (e.key === 'Escape') {
        setSelectedNode(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (!selectedNode) return;
        const newNode: Node = {
          ...selectedNode,
          id: generateId(),
          position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 },
          data: { ...selectedNode.data },
        };
        setNodes((nds) => nds.concat(newNode));
        setSelectedNode(newNode);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelectedNode, selectedNode, setNodes, setSelectedNode]);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setSelectedNode(node);
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, [setSelectedNode]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [contextMenu]);

  const handleContextMenuDelete = () => {
    if (contextMenu) {
      setNodes((nds) => nds.filter((n) => n.id !== contextMenu.node.id));
      setEdges((eds) => eds.filter((e) => e.source !== contextMenu.node.id && e.target !== contextMenu.node.id));
      setSelectedNode(null);
    }
    setContextMenu(null);
  };

  const handleContextMenuDuplicate = () => {
    if (contextMenu) {
      const newNode: Node = {
        ...contextMenu.node,
        id: generateId(),
        position: { x: contextMenu.node.position.x + 40, y: contextMenu.node.position.y + 40 },
        data: { ...contextMenu.node.data },
      };
      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    }
    setContextMenu(null);
  };

  // Stats
  const envCount = nodes.filter((n) => (n.data.nodeType as string)?.startsWith('environment')).length;
  const containerCount = nodes.filter((n) => (n.data.nodeType as string)?.startsWith('container')).length;
  const resourceCount = nodes.filter((n) => ['repo', 'database', 'vector.store', 'secrets'].includes(n.data.nodeType as string)).length;

  return (
    <div className="orch-grid" style={{ gridTemplateColumns: '220px 1fr 280px', gap: 14 }}>
      {/* Palette Panel */}
      <PalettePanel
        projects={projects}
        selectedId={project.id}
        onSelect={onSelect}
      />

      {/* React Flow Canvas */}
      <div className="orch-card" style={{ overflow: 'hidden', position: 'relative' }}>
        <div className="orch-wf-toolbar" style={{ zIndex: 10 }}>
          <button className="orch-icon-btn" title="Select (click nodes)" onClick={() => {}}><MousePointer size={14} /></button>
          <button className="orch-icon-btn" title="Delete selected node (Del)" onClick={deleteSelectedNode} disabled={!selectedNode}><Trash2 size={14} /></button>
          <div style={{ position: 'relative' }} ref={addMenuRef}>
            <button className="orch-icon-btn" title="Add node" onClick={() => setShowAddMenu(!showAddMenu)}><Plus size={14} /></button>
            {showAddMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: 'var(--bg-2)', border: '1px solid var(--border-c)', borderRadius: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 180, maxHeight: 300, overflowY: 'auto',
              }}>
                {PALETTE_CATEGORIES.map((cat) => {
                  const items = PALETTE_ITEMS.filter((i) => i.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', padding: '6px 10px 2px' }}>{cat}</div>
                      {items.map((item) => (
                        <div key={item.type} className="orch-row" style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }} onClick={() => handleAddNode(item.type, item.label)}>
                          <span className="orch-row-icon" style={{ width: 20, height: 20, background: `${item.color}22`, color: item.color, fontSize: 10, marginRight: 8 }}>{item.icon}</span>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button className="orch-icon-btn" title="Auto-layout" onClick={handleAutoLayout}><Maximize2 size={14} /></button>
          <div style={{ flex: 1 }} />
          <button className="orch-icon-btn" title="Save" onClick={handleSave} disabled={saving}><Save size={14} /></button>
          <button className="orch-icon-btn" title="Export JSON" onClick={handleExport}><Download size={14} /></button>
        </div>
        <div ref={reactFlowWrapper} style={{ height: 'stretch' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={handleNodeContextMenu}
            nodeTypes={projectNodeTypes}
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

      {/* Context Menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
          background: 'var(--bg-2)', border: '1px solid var(--border-c)', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 160, overflow: 'hidden',
        }}>
          <div className="orch-row" style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }} onClick={handleContextMenuDuplicate}>
            <Users size={13} style={{ marginRight: 8 }} /> Duplicate (Ctrl+D)
          </div>
          <div className="orch-row" style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--red)' }} onClick={handleContextMenuDelete}>
            <Trash2 size={13} style={{ marginRight: 8 }} /> Delete
          </div>
        </div>
      )}

      {/* Inspector Panel + System Health */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectInspectorPanel
          project={project}
          selectedNode={selectedNode}
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onSave={handleSave}
          saving={saving}
          agents={agents}
          workflows={workflows}
        />
        {project.id === 'project-lofiaistudio' && (
          <SystemHealthPanel />
        )}
      </div>
    </div>
  );
}

// ─── System Health Panel ────────────────────────────────────────────────────────

function RuntimeStatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: connected ? '#28a745' : '#dc3545',
        boxShadow: connected ? '0 0 6px rgba(40, 167, 69, 0.6)' : 'none',
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

const RUNTIME_LABELS: Record<string, string> = {
  ollama: 'Ollama (LLM)',
  'llama-cpp': 'Llama.cpp',
  comfyui: 'ComfyUI (Image)',
  'qwen3-asr': 'Qwen3 ASR',
  'qwen3-tts': 'Qwen3 TTS',
  a1111: 'A1111',
  svd: 'SVD',
  animatediff: 'AnimateDiff',
};

function SystemHealthPanel() {
  const [runtimes, setRuntimes] = useState<RuntimeStatus[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/runtimes');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRuntimes(json.data as RuntimeStatus[]);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const connected = runtimes.filter((r) => r.connected).length;
  const totalModels = runtimes.reduce((sum, r) => sum + (r.models?.length ?? 0), 0);

  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
      <div
        className="orch-card-header"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="orch-card-title">
          <Activity size={14} /> System Health
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {loading ? '...' : `${connected}/${runtimes.length}`}
          </span>
          <button
            className="orch-icon-btn"
            title="Refresh"
            onClick={(e) => { e.stopPropagation(); fetchStatus(); }}
            style={{ fontSize: 12 }}
          >
            &#x21bb;
          </button>
        </div>
      </div>
      {expanded && (
        <div className="orch-card-body" style={{ padding: '8px 12px' }}>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 11 }}>
            <span style={{ color: 'var(--text-2)' }}>
              <span style={{ color: '#28a745', fontWeight: 600 }}>{connected}</span> connected
            </span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span style={{ color: 'var(--text-2)' }}>
              <span style={{ fontWeight: 600 }}>{totalModels}</span> models
            </span>
          </div>
          {/* Runtime list */}
          {runtimes.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 0' }}>
              No runtimes discovered.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {runtimes.map((rt) => (
              <div
                key={rt.type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 6px',
                  borderRadius: 4,
                  background: rt.connected ? 'rgba(40,167,69,0.06)' : 'rgba(220,53,69,0.06)',
                  fontSize: 11.5,
                }}
              >
                <RuntimeStatusDot connected={rt.connected} />
                <span style={{ fontWeight: 500, flex: 1, minWidth: 0 }}>
                  {RUNTIME_LABELS[rt.type] ?? rt.type}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 10, whiteSpace: 'nowrap' }}>
                  {rt.models?.length ?? 0} models
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: rt.connected ? '#28a745' : '#dc3545',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rt.connected ? 'UP' : 'DOWN'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Palette Panel ──────────────────────────────────────────────────────────────

function PalettePanel({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', `${nodeType}::${label}`);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
      <div className="orch-card-header"><div className="orch-card-title"><Layers size={14} /> Node palette</div></div>
      <div style={{ padding: 8 }}>
        <select
          className="orch-select"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          style={{ marginBottom: 8 }}
        >
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {PALETTE_CATEGORIES.map((category) => {
          const items = PALETTE_ITEMS.filter((i) => i.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category}>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', padding: '8px 4px 4px' }}>
                {category}
              </div>
              {items.map((item) => (
                <div
                  key={item.type}
                  className="orch-row"
                  style={{ padding: 8, border: 'none', borderRadius: 6, cursor: 'grab' }}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type, item.label)}
                >
                  <div className="orch-row-icon" style={{ width: 26, height: 26, background: `${item.color}22`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div className="orch-row-main"><div className="orch-row-title" style={{ fontSize: 12.5 }}>{item.label}</div></div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────────

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', padding: '8px 4px 4px' }}>{title}</div>
      {children}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Inspector Panel ───────────────────────────────────────────────────────────

function ProjectInspectorPanel({
  project,
  selectedNode,
  nodes,
  edges,
  onNodesChange,
  onSave,
  saving,
  agents,
  workflows,
}: {
  project: Project;
  selectedNode: Node | null;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: React.Dispatch<React.SetStateAction<Node[]>>;
  onSave: () => void;
  saving: boolean;
  agents: { id: string; name: string }[];
  workflows: { id: string; name: string }[];
}) {
  const liveNode = selectedNode ? nodes.find((n) => n.id === selectedNode.id) ?? null : null;
  const nodeConfig = liveNode?.data?.config as Record<string, unknown> | undefined;
  const nodeType = liveNode?.data?.nodeType as ProjectNodeType | undefined;
  const selectedNodeId = liveNode?.id ?? null;

  const updateNodeLabel = useCallback((label: string) => {
    if (!selectedNodeId) return;
    onNodesChange((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, label } }
          : n,
      ),
    );
  }, [selectedNodeId, onNodesChange]);

  const updateConfig = useCallback((key: string, value: unknown) => {
    if (!selectedNodeId) return;
    onNodesChange((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown> ?? {}), [key]: value } } }
          : n,
      ),
    );
  }, [selectedNodeId, onNodesChange]);

  const removeConfigKey = useCallback((key: string) => {
    if (!selectedNodeId) return;
    onNodesChange((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const config = { ...(n.data.config as Record<string, unknown> ?? {}) };
        delete config[key];
        return { ...n, data: { ...n.data, config } };
      }),
    );
  }, [selectedNodeId, onNodesChange]);

  const envCount = nodes.filter((n) => (n.data.nodeType as string)?.startsWith('environment')).length;
  const containerCount = nodes.filter((n) => (n.data.nodeType as string)?.startsWith('container')).length;
  const resourceCount = nodes.filter((n) => ['repo', 'database', 'vector.store', 'secrets'].includes(n.data.nodeType as string)).length;

  const renderConfigFields = () => {
    if (!nodeType) return null;

    if (nodeType.startsWith('environment.')) {
      const config = (nodeConfig ?? {}) as EnvironmentConfig;
      return (
        <>
          <Field label="URL / Endpoint">
            <input className="orch-input" value={config.url ?? ''} onChange={(e) => updateConfig('url', e.target.value)} placeholder="e.g. https://dev.example.com" />
          </Field>
          <Field label="Description">
            <textarea className="orch-textarea" rows={2} value={config.description ?? ''} onChange={(e) => updateConfig('description', e.target.value)} placeholder="What is this environment for?" />
          </Field>
          <Field label="Variables (JSON)">
            <textarea
              className="orch-textarea"
              rows={4}
              value={JSON.stringify(config.variables ?? {}, null, 2)}
              onChange={(e) => {
                try { updateConfig('variables', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
          <Field label="Resource Limits">
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="orch-input" placeholder="CPU" value={config.resourceLimits?.cpu ?? ''} onChange={(e) => updateConfig('resourceLimits', { ...(config.resourceLimits ?? {}), cpu: e.target.value })} style={{ flex: 1 }} />
              <input className="orch-input" placeholder="Memory" value={config.resourceLimits?.memory ?? ''} onChange={(e) => updateConfig('resourceLimits', { ...(config.resourceLimits ?? {}), memory: e.target.value })} style={{ flex: 1 }} />
              <input className="orch-input" placeholder="Storage" value={config.resourceLimits?.storage ?? ''} onChange={(e) => updateConfig('resourceLimits', { ...(config.resourceLimits ?? {}), storage: e.target.value })} style={{ flex: 1 }} />
            </div>
          </Field>
        </>
      );
    }

    if (nodeType.startsWith('container.')) {
      const config = (nodeConfig ?? {}) as ContainerConfig;
      return (
        <>
          <Field label="Image">
            <input className="orch-input" value={config.image ?? ''} onChange={(e) => updateConfig('image', e.target.value)} placeholder="e.g. nginx:latest" />
          </Field>
          <Field label="CPU Limit">
            <input className="orch-input" value={config.cpuLimit ?? ''} onChange={(e) => updateConfig('cpuLimit', e.target.value)} placeholder="e.g. 1.0" />
          </Field>
          <Field label="Memory Limit">
            <input className="orch-input" value={config.memoryLimit ?? ''} onChange={(e) => updateConfig('memoryLimit', e.target.value)} placeholder="e.g. 512Mi" />
          </Field>
          <Field label="Volume Mount">
            <input className="orch-input" value={config.volumeMount ?? ''} onChange={(e) => updateConfig('volumeMount', e.target.value)} placeholder="e.g. /data" />
          </Field>
          <Field label="Environment Variables (JSON)">
            <textarea
              className="orch-textarea"
              rows={4}
              value={JSON.stringify(config.environmentVariables ?? {}, null, 2)}
              onChange={(e) => {
                try { updateConfig('environmentVariables', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
          {nodeType === 'container.compute' && (
            <Field label="Scaling">
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="orch-input" type="number" min={1} placeholder="Min" value={config.scaling?.min ?? 1} onChange={(e) => updateConfig('scaling', { ...(config.scaling ?? {}), min: parseInt(e.target.value) || 1 })} style={{ flex: 1 }} />
                <input className="orch-input" type="number" min={1} placeholder="Max" value={config.scaling?.max ?? 1} onChange={(e) => updateConfig('scaling', { ...(config.scaling ?? {}), max: parseInt(e.target.value) || 1 })} style={{ flex: 1 }} />
              </div>
            </Field>
          )}
        </>
      );
    }

    if (nodeType === 'repo') {
      const config = (nodeConfig ?? {}) as RepoConfig;
      return (
        <>
          <Field label="Git URL">
            <input className="orch-input" value={config.gitUrl ?? ''} onChange={(e) => updateConfig('gitUrl', e.target.value)} placeholder="e.g. https://github.com/user/repo.git" />
          </Field>
          <Field label="Branch">
            <input className="orch-input" value={config.branch ?? ''} onChange={(e) => updateConfig('branch', e.target.value)} placeholder="e.g. main" />
          </Field>
          <Field label="Auth Token">
            <input className="orch-input" type="password" value={config.authToken ?? ''} onChange={(e) => updateConfig('authToken', e.target.value)} placeholder="GitHub token" />
          </Field>
          <Field label="Auto Sync">
            <select className="orch-select" value={String(config.autoSync ?? false)} onChange={(e) => updateConfig('autoSync', e.target.value === 'true')}>
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </Field>
        </>
      );
    }

    if (nodeType === 'database') {
      const config = (nodeConfig ?? {}) as DatabaseConfig;
      return (
        <>
          <Field label="Database Type">
            <select className="orch-select" value={config.dbType ?? 'postgres'} onChange={(e) => updateConfig('dbType', e.target.value)}>
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="mongodb">MongoDB</option>
              <option value="redis">Redis</option>
            </select>
          </Field>
          <Field label="Connection String">
            <input className="orch-input" value={config.connectionString ?? ''} onChange={(e) => updateConfig('connectionString', e.target.value)} placeholder="postgresql://..." />
          </Field>
          <Field label="Backup Schedule (cron)">
            <input className="orch-input" value={config.backupSchedule ?? ''} onChange={(e) => updateConfig('backupSchedule', e.target.value)} placeholder="e.g. 0 2 * * *" />
          </Field>
        </>
      );
    }

    if (nodeType === 'vector.store') {
      const config = (nodeConfig ?? {}) as VectorStoreConfig;
      return (
        <>
          <Field label="Store Type">
            <select className="orch-select" value={config.storeType ?? 'chroma'} onChange={(e) => updateConfig('storeType', e.target.value)}>
              <option value="chroma">Chroma</option>
              <option value="pinecone">Pinecone</option>
              <option value="weaviate">Weaviate</option>
              <option value="qdrant">Qdrant</option>
              <option value="milvus">Milvus</option>
            </select>
          </Field>
          <Field label="Dimensions">
            <input className="orch-input" type="number" min={1} max={8192} value={config.dimension ?? 768} onChange={(e) => updateConfig('dimension', parseInt(e.target.value) || 768)} />
          </Field>
          <Field label="Connection String">
            <input className="orch-input" value={config.connectionString ?? ''} onChange={(e) => updateConfig('connectionString', e.target.value)} placeholder="e.g. http://localhost:8000" />
          </Field>
        </>
      );
    }

    if (nodeType === 'service') {
      const config = (nodeConfig ?? {}) as ServiceConfig;
      return (
        <>
          <Field label="Port">
            <input className="orch-input" type="number" min={1} max={65535} value={config.port ?? 80} onChange={(e) => updateConfig('port', parseInt(e.target.value) || 80)} />
          </Field>
          <Field label="Protocol">
            <select className="orch-select" value={config.protocol ?? 'http'} onChange={(e) => updateConfig('protocol', e.target.value)}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="grpc">gRPC</option>
              <option value="tcp">TCP</option>
            </select>
          </Field>
          <Field label="Health Check URL">
            <input className="orch-input" value={config.healthCheckUrl ?? ''} onChange={(e) => updateConfig('healthCheckUrl', e.target.value)} placeholder="e.g. /health" />
          </Field>
        </>
      );
    }

    if (nodeType === 'workflow.ref') {
      const config = (nodeConfig ?? {}) as WorkflowRefConfig;
      return (
        <>
          <Field label="Workflow">
            <select className="orch-select" value={config.workflowId ?? ''} onChange={(e) => updateConfig('workflowId', e.target.value)}>
              <option value="">Select workflow…</option>
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Input Mapping (JSON)">
            <textarea
              className="orch-textarea"
              rows={3}
              value={JSON.stringify(config.inputMapping ?? {}, null, 2)}
              onChange={(e) => {
                try { updateConfig('inputMapping', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
          <Field label="Output Mapping (JSON)">
            <textarea
              className="orch-textarea"
              rows={3}
              value={JSON.stringify(config.outputMapping ?? {}, null, 2)}
              onChange={(e) => {
                try { updateConfig('outputMapping', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'agent.ref') {
      const config = (nodeConfig ?? {}) as AgentRefConfig;
      return (
        <>
          <Field label="Agent">
            <select className="orch-select" value={config.agentId ?? ''} onChange={(e) => updateConfig('agentId', e.target.value)}>
              <option value="">Select agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <input className="orch-input" value={config.role ?? ''} onChange={(e) => updateConfig('role', e.target.value)} placeholder="e.g. QA Engineer" />
          </Field>
        </>
      );
    }

    if (nodeType === 'deployment') {
      const config = (nodeConfig ?? {}) as DeploymentConfig;
      return (
        <>
          <Field label="Target Environment">
            <select className="orch-select" value={config.targetEnvironment ?? ''} onChange={(e) => updateConfig('targetEnvironment', e.target.value)}>
              <option value="">Select environment…</option>
              <option value="environment.dev">Dev</option>
              <option value="environment.staging">Staging</option>
              <option value="environment.prod">Production</option>
            </select>
          </Field>
          <Field label="Strategy">
            <select className="orch-select" value={config.strategy ?? 'rolling'} onChange={(e) => updateConfig('strategy', e.target.value)}>
              <option value="rolling">Rolling</option>
              <option value="blue-green">Blue/Green</option>
              <option value="canary">Canary</option>
            </select>
          </Field>
          <Field label="Auto Deploy">
            <select className="orch-select" value={String(config.autoDeploy ?? false)} onChange={(e) => updateConfig('autoDeploy', e.target.value === 'true')}>
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </Field>
        </>
      );
    }

    if (nodeType === 'endpoint') {
      const config = (nodeConfig ?? {}) as EndpointConfig;
      return (
        <>
          <Field label="Path">
            <input className="orch-input" value={config.path ?? ''} onChange={(e) => updateConfig('path', e.target.value)} placeholder="e.g. /api/v1/users" />
          </Field>
          <Field label="Method">
            <select className="orch-select" value={config.method ?? 'GET'} onChange={(e) => updateConfig('method', e.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </Field>
          <Field label="Rate Limit (req/min)">
            <input className="orch-input" type="number" min={0} value={config.rateLimit ?? 0} onChange={(e) => updateConfig('rateLimit', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Auth">
            <select className="orch-select" value={config.auth ?? 'none'} onChange={(e) => updateConfig('auth', e.target.value)}>
              <option value="none">None</option>
              <option value="api-key">API Key</option>
              <option value="jwt">JWT</option>
            </select>
          </Field>
        </>
      );
    }

    if (nodeType === 'secrets') {
      const config = (nodeConfig ?? {}) as SecretsConfig;
      return (
        <>
          <Field label="Provider">
            <select className="orch-select" value={config.provider ?? 'env'} onChange={(e) => updateConfig('provider', e.target.value)}>
              <option value="env">Environment Variables</option>
              <option value="vault">HashiCorp Vault</option>
              <option value="aws-secrets">AWS Secrets Manager</option>
              <option value="gcp-secret-manager">GCP Secret Manager</option>
            </select>
          </Field>
          <Field label="Secret Keys (comma-separated)">
            <input className="orch-input" value={(config.keys ?? []).join(', ')} onChange={(e) => updateConfig('keys', e.target.value.split(',').map((k) => k.trim()).filter(Boolean))} placeholder="DATABASE_URL, API_KEY" />
          </Field>
        </>
      );
    }

    // Generic fallback
    if (nodeConfig && Object.keys(nodeConfig).length > 0) {
      const keys = Object.keys(nodeConfig);
      return (
        <>
          {keys.map((key) => {
            const val = nodeConfig[key];
            return (
              <Field key={key} label={key}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="orch-input" value={String(val ?? '')} onChange={(e) => updateConfig(key, e.target.value)} />
                  <button className="orch-icon-btn" title={`Remove ${key}`} onClick={() => removeConfigKey(key)} style={{ flexShrink: 0, fontSize: 14, color: 'var(--text-3)' }}>✕</button>
                </div>
              </Field>
            );
          })}
        </>
      );
    }

    return (
      <Field label="Config (JSON)">
        <textarea
          className="orch-textarea"
          rows={4}
          value={JSON.stringify(nodeConfig ?? {}, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (selectedNode) {
                onNodesChange((nds) =>
                  nds.map((n) =>
                    n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, config: parsed } }
                      : n,
                  ),
                );
              }
            } catch {/* ignore */}
          }}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
        />
      </Field>
    );
  };

  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
      <div className="orch-card-header">
        <div className="orch-card-title"><Layers size={14} /> Inspector</div>
        <span className="orch-chip purple">{project.name}</span>
      </div>
      <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {liveNode ? (
          <>
            <Field label="Node label">
              <input className="orch-input" value={liveNode.data.label as string} onChange={(e) => updateNodeLabel(e.target.value)} />
            </Field>
            <Field label="Type">
              <input className="orch-input" value={liveNode.data.nodeType as string} readOnly />
            </Field>
            {renderConfigFields()}
          </>
        ) : (
          <div style={{ color: 'var(--text-2)', fontSize: 13, textAlign: 'center', padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <Layers size={32} style={{ opacity: 0.3 }} />
            </div>
            Select a node to inspect its properties<br />
            or drag from the palette to add new ones.
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="orch-btn primary" style={{ flex: 1 }} onClick={onSave} disabled={saving}>
            <Save size={14} />{saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
          {nodes.length} nodes · {edges.length} connections
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', display: 'flex', gap: 8, justifyContent: 'center' }}>
          <span>{envCount} environment{envCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{containerCount} container{containerCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{resourceCount} resource{resourceCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}