import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { Skill, Workflow as WorkflowType, WorkflowNode, WorkflowEdge, WorkflowRun, Webhook, WorkflowVersion } from '@lofiaistudio/shared';
import { convertComfyUI, convertN8N } from '@lofiaistudio/shared';
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
  Bell,
  BookOpen,
  Brackets,
  Clock,
  Code2,
  Cpu,
  Database,
  Download,
  GitBranch,
  GitMerge,
  Globe,
  Image as ImageIcon,
  Layers,
  List as ListIcon,
  Mail,
  Maximize2,
  Mic2,
  Minus,
  MousePointer,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Route,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react';

// ─── React Flow Node Types ───────────────────────────────────────────────────

type PaletteColor = 'trigger' | 'model' | 'skill' | 'logic' | 'output' | 'utility';

const NODE_TYPE_COLOR: Record<string, PaletteColor> = {
  'trigger.schedule': 'trigger',
  'trigger.manual': 'trigger',
  'model.text': 'model',
  'model.image': 'model',
  'model.video': 'model',
  'model.audio.tts': 'model',
  'model.audio.stt': 'model',
  skill: 'skill',
  'output.note': 'output',
  'output.toast': 'output',
  'output.file': 'output',
  'output.database': 'output',
  'output.email': 'output',
  'logic.branch': 'logic',
  'logic.loop': 'logic',
  'logic.transform': 'logic',
  'logic.merge': 'logic',
  'utility.comment': 'utility',
  'utility.subworkflow': 'utility',
  'utility.http': 'utility',
};

// ─── Palette configuration (mirroring Project Editor's categorized pattern) ──

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}

const PALETTE_COLORS: Record<PaletteColor, string> = {
  trigger: '#28a745',
  model: '#e83e8c',
  skill: '#6f42c1',
  logic: '#0dcaf0',
  output: '#ffc658',
  utility: '#6c757d',
};

const NODE_TYPE_ICON: Record<string, string> = {
  'trigger.schedule': '🕐',
  'trigger.manual': '▶',
  'model.text': '💬',
  'model.image': '🖼',
  'model.video': '🎬',
  'model.audio.tts': '🔊',
  'model.audio.stt': '🎤',
  skill: '⚙',
  'output.note': '📌',
  'output.toast': '🔔',
  'output.file': '💾',
  'output.database': '🗄',
  'output.email': '📧',
  'logic.branch': '🔀',
  'logic.loop': '🔄',
  'logic.transform': '🔧',
  'logic.merge': '🔗',
  'utility.comment': '📝',
  'utility.subworkflow': '📂',
  'utility.http': '🌐',
};

const PALETTE_ITEMS: PaletteItem[] = [
  // Triggers (green)
  { type: 'trigger.manual', label: 'Manual Trigger', icon: <Play size={13} />, color: '#28a745', category: 'Triggers' },
  { type: 'trigger.schedule', label: 'Schedule (Cron)', icon: <Clock size={13} />, color: '#28a745', category: 'Triggers' },
  // Models (pink)
  { type: 'model.text', label: 'Text LLM', icon: <Cpu size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.image', label: 'Image Gen', icon: <ImageIcon size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.video', label: 'Video Gen', icon: <Play size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.audio.tts', label: 'Voice Synthesizer', icon: <Mic2 size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.audio.stt', label: 'Speech-to-Text', icon: <Mic2 size={13} />, color: '#e83e8c', category: 'AI Models' },
  // Skills (purple)
  // Logic (cyan)
  { type: 'logic.branch', label: 'Branch/Conditional', icon: <GitBranch size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'logic.loop', label: 'Loop/Foreach', icon: <Repeat size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'logic.transform', label: 'Transform', icon: <Code2 size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'logic.merge', label: 'Merge/Join', icon: <GitMerge size={13} />, color: '#0dcaf0', category: 'Logic' },
  // Outputs (amber)
  { type: 'output.toast', label: 'Toast Notification', icon: <Bell size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.note', label: 'Note', icon: <BookOpen size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.file', label: 'Save to File', icon: <Save size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.database', label: 'Save to Database', icon: <Database size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.email', label: 'Email', icon: <Mail size={13} />, color: '#ffc658', category: 'Outputs' },
  // Utility (gray)
  { type: 'utility.comment', label: 'Comment', icon: <BookOpen size={13} />, color: '#6c757d', category: 'Utility' },
  { type: 'utility.subworkflow', label: 'Sub-workflow', icon: <Layers size={13} />, color: '#6c757d', category: 'Utility' },
  { type: 'utility.http', label: 'HTTP Request', icon: <Globe size={13} />, color: '#6c757d', category: 'Utility' },
];

const PALETTE_CATEGORIES = ['Triggers', 'AI Models', 'Skills', 'Logic', 'Outputs', 'Utility'];

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const headColor = data.nodeType ? (NODE_TYPE_COLOR[data.nodeType as string] ?? 'skill') : 'skill';
  return (
    <div className={`orch-node${selected ? ' selected' : ''}`} style={{ width: 180, position: 'relative' }}>
      <div className={`orch-node-head ${headColor}`}>
        <span style={{ fontSize: 11, opacity: 0.7 }}>{NODE_TYPE_ICON[data.nodeType as string] ?? '⚙'}</span>
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

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

// ─── External (imported) workflow types ──────────────────────────────────────

type ExternalFormat = 'comfyui' | 'n8n' | 'generic';

function detectFormat(data: unknown): ExternalFormat {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'generic';
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
    const sample = obj[keys[0]];
    if (sample && typeof sample === 'object' && 'class_type' in (sample as object)) return 'comfyui';
  }
  if ('nodes' in obj && Array.isArray(obj.nodes) && 'connections' in obj) return 'n8n';
  return 'generic';
}

function isOrchestrationWorkflow(data: unknown): data is Partial<WorkflowType> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  return 'name' in obj && Array.isArray(obj.nodes) && Array.isArray(obj.edges);
}

function triggerDownload(filename: string, content: unknown) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const EXT_FORMAT_LABEL: Record<ExternalFormat, string> = { comfyui: 'ComfyUI', n8n: 'n8n', generic: 'JSON' };
const DEFAULT_WORKFLOW_CATEGORY = 'General';

function workflowCategory(workflow: Partial<WorkflowType>): string {
  return workflow.category?.trim() || DEFAULT_WORKFLOW_CATEGORY;
}

function comfySkillName(classType: string): string {
  return `comfyui.${classType}`;
}

function comfySkillId(classType: string): string {
  return `skill-comfyui-${classType.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node'}`;
}

function extractComfyClassTypes(data: Record<string, unknown>): string[] {
  const types = new Set<string>();
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && 'class_type' in value) {
      const classType = String((value as { class_type?: unknown }).class_type ?? '').trim();
      if (classType) types.add(classType);
    }
  }
  return Array.from(types);
}

function createFluxImageWorkflow(): Partial<WorkflowType> {
  const triggerId = generateId();
  const imageId = generateId();
  const outputId = generateId();
  return {
    name: 'Flux Image Creation',
    description: 'Generate Flux-style images with editable prompt and image parameters.',
    project: 'Image',
    category: 'Image',
    enabled: true,
    nodes: [
      { id: triggerId, type: 'trigger.manual', label: 'Manual trigger', x: 80, y: 120, config: {} },
      {
        id: imageId,
        type: 'model.image',
        label: 'Flux image',
        x: 360,
        y: 120,
        config: {
          prompt: 'A cinematic Flux image, crisp detail, natural lighting',
          negativePrompt: '',
          width: 512,
          height: 512,
          steps: 20,
          cfgScale: 7.5,
          sampler: 'euler',
          scheduler: 'normal',
        },
      },
      { id: outputId, type: 'output.note', label: 'Image result', x: 640, y: 120, config: { note: 'Flux image generation completed.' } },
    ],
    edges: [
      { id: generateId(), from: triggerId, to: imageId },
      { id: generateId(), from: imageId, to: outputId },
    ],
  };
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'editor' | 'all' | 'marketplace' | 'categories' | 'runs' | 'triggers' | 'versions';

// ─── Helper: native Workflow ↔ React Flow nodes/edges ───────────────────────

function workflowToFlow(workflow: WorkflowType): { nodes: Node[]; edges: Edge[] } {
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

function flowToWorkflow(
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

// ─── Main panel ───────────────────────────────────────────────────────────────

export function WorkflowsPanel() {
  const { workflows, workflowRuns, skills, loadAll, openDrawer, runWorkflow, createEntity, updateEntity, pushToast } = useOrchestrationStore();
  const [tab, setTab] = useState<Tab>('editor');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const comfySkillCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    for (const skill of skills) {
      if (skill.category === 'ComfyUI') {
        comfySkillCacheRef.current.set(skill.name, skill.id);
      }
    }
  }, [skills]);

  const selected = workflows.find((w) => w.id === selectedId) ?? workflows[0] ?? null;
  const visibleWorkflows = useMemo(
    () => workflows.filter((workflow) => categoryFilter === 'All categories' || workflowCategory(workflow) === categoryFilter),
    [workflows, categoryFilter]
  );
  const workflowCategories = useMemo(
    () => ['All categories', ...Array.from(new Set(workflows.map(workflowCategory)))],
    [workflows]
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workflow of workflows) {
      const category = workflowCategory(workflow);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [workflows]);
  const marketplaceWorkflows = useMemo(
    () => [
      {
        id: 'mkt-flux-image-creation',
        name: 'Flux Image Creation',
        category: 'Image',
        description: 'Native image generation workflow with editable Flux-style prompt and dimensions.',
        nodeCount: 3,
      },
    ],
    []
  );

  // Export the current orchestration workflow as JSON
  const exportWorkflow = (wf: WorkflowType) => triggerDownload(`${wf.name}.json`, wf);

  // Save the current workflow from the editor
  const handleSave = useCallback(async (workflow: WorkflowType, flowNodes: Node[], flowEdges: Edge[]) => {
    setSaving(true);
    const updated = flowToWorkflow(workflow, flowNodes, flowEdges);
    try {
      await updateEntity('workflows', workflow.id, updated);
      pushToast('Workflow saved');
    } catch {
      pushToast('Failed to save workflow');
    }
    setSaving(false);
  }, [updateEntity, pushToast]);

  // Import JSON: orchestration format → store, external format → convert + store
  const ensureComfySkills = useCallback(async (classTypes: string[]) => {
    const skillIdsByName = new Map(skills.map((skill) => [skill.name, skill.id]));
    for (const [name, id] of comfySkillCacheRef.current.entries()) {
      if (!skillIdsByName.has(name)) skillIdsByName.set(name, id);
    }
    const skillIdsByClass = new Map<string, string>();

    for (const classType of classTypes) {
      const name = comfySkillName(classType);
      const existingId = skillIdsByName.get(name);
      if (existingId) {
        skillIdsByClass.set(classType, existingId);
        continue;
      }
      try {
        const created = await createEntity('skills', {
          id: comfySkillId(classType),
          name,
          category: 'ComfyUI',
          description: `Imported ComfyUI node class: ${classType}`,
          usedBy: 0,
          runs7d: 0,
          avgLatency: '-',
          cost: 'Free',
          enabled: true,
          executionType: 'internal',
          runInputDefaults: {},
          configSchema: {
            type: 'object',
            properties: {
              input: { type: 'object', description: 'ComfyUI node input values captured during import.' },
            },
          },
        } as Partial<Skill>);
        skillIdsByClass.set(classType, created.id);
        skillIdsByName.set(name, created.id);
        comfySkillCacheRef.current.set(name, created.id);
      } catch {
        pushToast(`Failed to create ComfyUI skill: ${name}`);
      }
    }

    return skillIdsByClass;
  }, [createEntity, pushToast, skills]);

  const importFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const text = await file.text().catch(() => null);
      if (!text) continue;
      let data: unknown;
      try { data = JSON.parse(text); } catch { pushToast(`Could not parse ${file.name}`); continue; }

      if (isOrchestrationWorkflow(data)) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = data as WorkflowType;
        await createEntity('workflows', { ...payload, category: workflowCategory(payload) }).catch(() => pushToast(`Failed to import ${file.name}`));
        pushToast(`Imported workflow: ${payload.name ?? file.name}`);
      } else {
        const format = detectFormat(data);
        // Try to convert ComfyUI and n8n to native workflow format
        let converted: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null = null;
        const nativeName = file.name.replace(/\.json$/i, '');

        if (format === 'comfyui') {
          converted = convertComfyUI(data as Record<string, unknown>, nativeName);
          if (converted && converted.nodes.length > 0) {
            const skillIdsByClass = await ensureComfySkills(extractComfyClassTypes(data as Record<string, unknown>));
            converted = {
              ...converted,
              nodes: converted.nodes.map((node) => {
                const classType = typeof node.config.originalClassType === 'string' ? node.config.originalClassType : '';
                const skillId = classType ? skillIdsByClass.get(classType) : undefined;
                if (node.type !== 'skill' || !skillId) return node;
                return {
                  ...node,
                  config: {
                    ...node.config,
                    skillId,
                    input: node.config.originalInputs ?? {},
                  },
                };
              }),
            };
          }
        } else if (format === 'n8n') {
          converted = convertN8N(data as Record<string, unknown>, nativeName);
        }

        if (converted && converted.nodes.length > 0) {
          // Save as native workflow so it can be edited in the graph editor
          await createEntity('workflows', {
            name: nativeName,
            description: `Converted from ${EXT_FORMAT_LABEL[format]}`,
            project: format === 'comfyui' ? 'ComfyUI' : '',
            category: format === 'comfyui' ? 'ComfyUI' : 'Imported',
            enabled: true,
            nodes: converted.nodes,
            edges: converted.edges,
          }).catch(() => pushToast(`Failed to convert ${file.name}`));
          pushToast(`Converted ${EXT_FORMAT_LABEL[format]} → editable workflow: ${nativeName}`);
        } else {
          pushToast(`Failed to convert ${file.name}; read-only JSON imports are discarded`);
        }

        setSelectedId(selectedId); // keep selection
        setTab('editor');
      }
    }
  }, [createEntity, ensureComfySkills, pushToast, selectedId]);

  const installMarketplaceWorkflow = useCallback(async (id: string) => {
    if (id !== 'mkt-flux-image-creation') return;
    try {
      const created = await createEntity('workflows', createFluxImageWorkflow());
      setSelectedId(created.id);
      setTab('editor');
      pushToast('Installed workflow: Flux Image Creation');
    } catch {
      pushToast('Failed to install Flux Image Creation');
    }
  }, [createEntity, pushToast]);

  const allCount = workflows.length;

  return (
    <div className="orch-view">
      <div className="orch-view-header">
        <div>
          <h1 className="orch-view-title">Workflows</h1>
          <p className="orch-view-subtitle">Visual node graphs that chain skills, models, and logic. ComfyUI-style for everything.</p>
        </div>
        <div className="orch-view-actions">
          {selected && tab === 'editor' && (
            <>
              <button className="orch-btn" onClick={() => exportWorkflow(selected)}><Download size={14} />Export</button>
            </>
          )}
          <button className="orch-btn" onClick={() => fileRef.current?.click()}><Upload size={14} />Import</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }}
          />
          <button className="orch-btn primary" onClick={() => openDrawer('workflow')}><Plus />New workflow</button>
        </div>
      </div>

      <div className="orch-subtabs">
        <button className={`orch-subtab${tab === 'editor' ? ' active' : ''}`} onClick={() => setTab('editor')}>Editor</button>
        <button className={`orch-subtab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All workflows <span className="count">{allCount}</span></button>
        <button className={`orch-subtab${tab === 'marketplace' ? ' active' : ''}`} onClick={() => setTab('marketplace')}>Marketplace</button>
        <button className={`orch-subtab${tab === 'categories' ? ' active' : ''}`} onClick={() => setTab('categories')}>Categories</button>
        <button className={`orch-subtab${tab === 'runs' ? ' active' : ''}`} onClick={() => setTab('runs')}>Runs <span className="count">{workflowRuns.length}</span></button>
        <button className={`orch-subtab${tab === 'triggers' ? ' active' : ''}`} onClick={() => setTab('triggers')}>Triggers</button>
        <button className={`orch-subtab${tab === 'versions' ? ' active' : ''}`} onClick={() => setTab('versions')}>Versions</button>
      </div>

      {tab === 'editor' && (
        selected
            ? <ReactFlowProvider>
                <WorkflowEditorView
                  workflow={selected}
                  workflows={workflows}
                  onRun={() => runWorkflow(selected.id)}
                  onSelect={setSelectedId}
                  onExport={() => exportWorkflow(selected)}
                  onSave={handleSave}
                  saving={saving}
                />
              </ReactFlowProvider>
            : <div className="orch-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-2)' }}>
                No workflow selected. Create a new one or import a JSON file.
              </div>
      )}
      {tab === 'all' && (
        <AllWorkflowsList
          workflows={visibleWorkflows}
          categoryFilter={categoryFilter}
          categories={workflowCategories}
          onCategoryChange={setCategoryFilter}
          onEdit={(id) => openDrawer('workflow', id)}
          onRun={runWorkflow}
          onExport={exportWorkflow}
          onImport={() => fileRef.current?.click()}
        />
      )}
      {tab === 'marketplace' && (
        <MarketplaceWorkflowsList workflows={marketplaceWorkflows} onInstall={installMarketplaceWorkflow} />
      )}
      {tab === 'categories' && (
        <WorkflowCategoriesView
          categoryCounts={categoryCounts}
          onSelect={(category) => {
            setCategoryFilter(category);
            setTab('all');
          }}
        />
      )}
      {tab === 'runs' && <RunListWithPolling />}
      {tab === 'triggers' && <TriggersView />}
      {tab === 'versions' && <VersionsView workflowId={selected.id} />}
    </div>
  );
}

// ─── React Flow Editor View ──────────────────────────────────────────────────

function WorkflowEditorView({
  workflow,
  workflows,
  onRun,
  onSelect,
  onExport,
  onSave,
  saving,
}: {
  workflow: WorkflowType;
  workflows: WorkflowType[];
  onRun: () => void;
  onSelect: (id: string) => void;
  onExport: () => void;
  onSave: (workflow: WorkflowType, nodes: Node[], edges: Edge[]) => Promise<void>;
  saving: boolean;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => workflowToFlow(workflow), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Sync when workflow changes
  useEffect(() => {
    const { nodes: n, edges: e } = workflowToFlow(workflow);
    setNodes(n);
    setEdges(e);
    setSelectedNode(null);
  }, [workflow.id, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'smoothstep', animated: false, style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.6 } },
          eds,
        ),
      );
    },
    [setEdges],
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
        type: 'workflowNode',
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

  // Use refs to avoid stale closures in async callbacks
  const workflowRef = useRef(workflow);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  workflowRef.current = workflow;
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const handleSave = useCallback(() => {
    onSave(workflowRef.current, nodesRef.current, edgesRef.current);
  }, [onSave]);

  const handleRun = useCallback(() => {
    // Save before running using refs for latest values
    onSave(workflowRef.current, nodesRef.current, edgesRef.current).then(() => onRun());
  }, [onSave, onRun]);

  return (
    <div className="orch-grid" style={{ gridTemplateColumns: '220px 1fr 280px', gap: 14 }}>
      {/* Node palette */}
      <PalettePanel workflows={workflows} selectedId={workflow.id} onSelect={onSelect} onAddNode={(type, label, config) => {
        // Calculate position: cascade from last node or center
        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
        const pos = lastNode
          ? { x: lastNode.position.x + 220, y: lastNode.position.y }
          : { x: 300, y: 60 };
        // Wrap around if going off canvas
        const finalPos = pos.x > 700 ? { x: 60, y: pos.y + 100 } : pos;
        const newNode: Node = {
          id: generateId(),
          type: 'workflowNode',
          position: finalPos,
          data: { label, nodeType: type, config: config ?? {} },
        };
        setNodes((nds) => nds.concat(newNode));
      }} />

      {/* React Flow canvas */}
      <div className="orch-card" style={{ overflow: 'hidden', position: 'relative' }}>
        <div className="orch-wf-toolbar" style={{ zIndex: 10 }}>
          <button className="orch-icon-btn" title="Select (click nodes)" onClick={() => {}}><MousePointer size={14} /></button>
          <button className="orch-icon-btn" title="Delete selected node" onClick={deleteSelectedNode} disabled={!selectedNode}><Trash2 size={14} /></button>
          <button className="orch-icon-btn" title="Auto-layout" onClick={() => {
            // Auto-arrange nodes in a vertical layout
            if (nodes.length === 0) return;
            const sorted = [...nodes].sort((a, b) => {
              const aTrigger = (a.data.nodeType as string)?.startsWith('trigger') ? 0 : 1;
              const bTrigger = (b.data.nodeType as string)?.startsWith('trigger') ? 0 : 1;
              return aTrigger - bTrigger || a.position.x - b.position.x;
            });
            setNodes(sorted.map((n, i) => ({
              ...n,
              position: { x: 40 + Math.floor(i / 8) * 220, y: 40 + (i % 8) * 100 },
            })));
          }}><Maximize2 size={14} /></button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 12 }}>
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </span>
          <button className="orch-icon-btn" title="Save" onClick={handleSave}><Save size={14} /></button>
          <button className="orch-icon-btn" title="Run workflow" onClick={handleRun}><Play size={14} /></button>
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

      {/* Inspector */}
      <InspectorPanel
        workflow={workflow}
        selectedNode={selectedNode}
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes}
        onExport={onExport}
        onSave={handleSave}
        onRun={handleRun}
        saving={saving}
      />
    </div>
  );
}

// ─── Palette Panel (Compact category buttons with dropdowns) ─────────────────

interface CategoryButtonDef {
  label: string;
  color: string;
  icon: React.ReactNode;
  items: { type: string; label: string; preset?: Record<string, unknown> }[];
}

function PalettePanel({
  workflows,
  selectedId,
  onSelect,
  onAddNode,
}: {
  workflows: WorkflowType[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddNode: (type: string, label: string, config?: Record<string, unknown>) => void;
}) {
  const { skills, workflows: allWf, agents } = useOrchestrationStore();
  const enabledSkills = skills.filter((s) => s.enabled);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target;
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const categoryButtons: CategoryButtonDef[] = useMemo(() => [
    {
      label: 'Trigger', color: '#28a745', icon: <Play size={13} />,
      items: [
        { type: 'trigger.manual', label: 'Manual Trigger' },
        { type: 'trigger.schedule', label: 'Schedule (Cron)' },
      ],
    },
    {
      label: 'Model', color: '#e83e8c', icon: <Cpu size={13} />,
      items: [
        { type: 'model.text', label: 'Text LLM' },
        { type: 'model.image', label: 'Image Gen' },
        { type: 'model.video', label: 'Video Gen' },
        { type: 'model.audio.tts', label: 'Voice Synth' },
        { type: 'model.audio.stt', label: 'Speech-to-Text' },
      ],
    },
    {
      label: 'Skill', color: '#6f42c1', icon: <Wrench size={13} />,
      items: enabledSkills.length > 0
        ? enabledSkills.map((s) => ({ type: 'skill', label: s.name, preset: { skillId: s.id } }))
        : [{ type: 'skill', label: 'No skills installed', preset: {} }],
    },
    {
      label: 'Logic', color: '#0dcaf0', icon: <GitBranch size={13} />,
      items: [
        { type: 'logic.branch', label: 'Branch/Conditional' },
        { type: 'logic.loop', label: 'Loop/Foreach' },
        { type: 'logic.transform', label: 'Transform' },
        { type: 'logic.merge', label: 'Merge/Join' },
      ],
    },
    {
      label: 'Output', color: '#ffc658', icon: <Bell size={13} />,
      items: [
        { type: 'output.toast', label: 'Toast Notification' },
        { type: 'output.note', label: 'Note' },
        { type: 'output.file', label: 'Save to File' },
        { type: 'output.database', label: 'Save to Database' },
        { type: 'output.email', label: 'Email' },
      ],
    },
    {
      label: 'Utility', color: '#6c757d', icon: <Layers size={13} />,
      items: [
        { type: 'utility.comment', label: 'Comment' },
        { type: 'utility.subworkflow', label: 'Sub-workflow' },
        { type: 'utility.http', label: 'HTTP Request' },
      ],
    },
    {
      label: 'Agent', color: '#e83e8c', icon: <Users size={13} />,
      items: agents.length > 0
        ? agents.map((a) => ({ type: 'agent.ref', label: a.name, preset: { agentId: a.id, role: a.role } }))
        : [{ type: 'agent.ref', label: 'No agents created', preset: {} }],
    },
  ], [enabledSkills, agents]);

  const handleSelectItem = (buttonKey: string, item: { type: string; label: string; preset?: Record<string, unknown> }) => {
    setOpenDropdown(null);
    onAddNode(item.type, item.label, item.preset ?? {});
  };

  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
      <div className="orch-card-header"><div className="orch-card-title"><Workflow size={14} /> Node palette</div></div>
      <div style={{ padding: 8 }} ref={dropdownRef}>
        <select
          className="orch-select"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          style={{ marginBottom: 8 }}
        >
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        {categoryButtons.map((btn) => (
          <div key={btn.label} style={{ position: 'relative', marginBottom: 4 }}>
            <button
              className="orch-btn"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                gap: 8,
                padding: '6px 10px',
                fontSize: 12.5,
                border: `1px solid ${btn.color}44`,
                background: `${btn.color}11`,
                color: 'var(--text-1)',
                textAlign: 'left',
              }}
              onClick={() => setOpenDropdown(openDropdown === btn.label ? null : btn.label)}
            >
              <span style={{ color: btn.color }}>{btn.icon}</span>
              <span>+ Add {btn.label} Node</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>{btn.items.length}</span>
            </button>

            {openDropdown === btn.label && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-c)',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {btn.items.map((item) => (
                  <div
                    key={item.type + item.label}
                    className="orch-row"
                    style={{
                      padding: '6px 10px',
                      border: 'none',
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                    onClick={() => handleSelectItem(btn.label, item)}
                  >
                    <div
                      className="orch-row-icon"
                      style={{ width: 22, height: 22, background: `${btn.color}22`, color: btn.color, fontSize: 11 }}
                    >
                      {btn.icon}
                    </div>
                    <div className="orch-row-main">
                      <div className="orch-row-title" style={{ fontSize: 12 }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inspector Panel ─────────────────────────────────────────────────────────

function InspectorPanel({
  workflow,
  selectedNode,
  nodes,
  edges,
  onNodesChange,
  onExport,
  onSave,
  onRun,
  saving,
}: {
  workflow: WorkflowType;
  selectedNode: Node | null;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: React.Dispatch<React.SetStateAction<Node[]>>;
  onExport: () => void;
  onSave: () => void;
  onRun: () => void;
  saving: boolean;
}) {
  const { skills, workflows: allWorkflows } = useOrchestrationStore();
  // Derive the live node data from the nodes array to avoid stale references
  const liveNode = selectedNode ? nodes.find((n) => n.id === selectedNode.id) ?? null : null;
  const nodeConfig = liveNode?.data?.config as Record<string, unknown> | undefined;
  const nodeType = liveNode?.data?.nodeType as string | undefined;
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

  const renderConfigFields = () => {
    if (!nodeType) return null;

    // Type-specific config editors
    if (nodeType === 'model.text') {
      return (
        <>
          <Field label="Execution target">
            <select
              className="orch-select"
              value={(nodeConfig?.cloudProvider as string) ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                updateConfig('cloudProvider', value || undefined);
                if (!value) updateConfig('cloudModel', undefined);
              }}
            >
              <option value="">Local runtime</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="deepseek">Deepseek</option>
            </select>
          </Field>
          {(nodeConfig?.cloudProvider as string | undefined) && (
            <Field label="Cloud model">
              <input
                className="orch-input"
                value={(nodeConfig?.cloudModel as string) ?? ''}
                onChange={(e) => updateConfig('cloudModel', e.target.value)}
                placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, deepseek-chat"
              />
            </Field>
          )}
          <Field label="Model ID">
            <input
              className="orch-input"
              value={(nodeConfig?.modelId as string) ?? ''}
              onChange={(e) => updateConfig('modelId', e.target.value)}
              placeholder="e.g. llama3.2"
            />
          </Field>
          <Field label="Prompt">
            <textarea
              className="orch-textarea"
              rows={3}
              value={(nodeConfig?.prompt as string) ?? ''}
              onChange={(e) => updateConfig('prompt', e.target.value)}
              placeholder="Enter prompt text..."
            />
          </Field>
          <Field label="Temperature">
            <input
              className="orch-input"
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={(nodeConfig?.temperature as number) ?? 0.7}
              onChange={(e) => updateConfig('temperature', parseFloat(e.target.value) || 0.7)}
            />
          </Field>
          <Field label="Max tokens">
            <input
              className="orch-input"
              type="number"
              min={1}
              max={4096}
              step={1}
              value={(nodeConfig?.maxTokens as number) ?? 512}
              onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value) || 512)}
            />
          </Field>
          <Field label="System prompt">
            <textarea
              className="orch-textarea"
              rows={2}
              value={(nodeConfig?.systemPrompt as string) ?? ''}
              onChange={(e) => updateConfig('systemPrompt', e.target.value)}
              placeholder="Optional system prompt..."
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'model.image') {
      return (
        <>
          <Field label="Execution target">
            <select
              className="orch-select"
              value={(nodeConfig?.cloudProvider as string) ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                updateConfig('cloudProvider', value || undefined);
                if (!value) updateConfig('cloudModel', undefined);
              }}
            >
              <option value="">Local runtime</option>
              <option value="openai">OpenAI</option>
              <option value="stability-ai">Stability AI</option>
              <option value="replicate">Replicate</option>
            </select>
          </Field>
          {(nodeConfig?.cloudProvider as string | undefined) && (
            <Field label="Cloud model">
              <input
                className="orch-input"
                value={(nodeConfig?.cloudModel as string) ?? ''}
                onChange={(e) => updateConfig('cloudModel', e.target.value)}
                placeholder="e.g. dall-e-3, stable-diffusion-xl"
              />
            </Field>
          )}
          <Field label="Model ID">
            <input
              className="orch-input"
              value={(nodeConfig?.modelId as string) ?? ''}
              onChange={(e) => updateConfig('modelId', e.target.value)}
              placeholder="e.g. sdxl"
            />
          </Field>
          <Field label="Prompt">
            <textarea
              className="orch-textarea"
              rows={3}
              value={(nodeConfig?.prompt as string) ?? ''}
              onChange={(e) => updateConfig('prompt', e.target.value)}
              placeholder="Describe the image..."
            />
          </Field>
          <Field label="Negative prompt">
            <textarea
              className="orch-textarea"
              rows={2}
              value={(nodeConfig?.negativePrompt as string) ?? ''}
              onChange={(e) => updateConfig('negativePrompt', e.target.value)}
              placeholder="What to avoid..."
            />
          </Field>
          <Field label="Steps">
            <input
              className="orch-input"
              type="number"
              min={1}
              max={150}
              value={(nodeConfig?.steps as number) ?? 20}
              onChange={(e) => updateConfig('steps', parseInt(e.target.value) || 20)}
            />
          </Field>
          <Field label="Width">
            <input
              className="orch-input"
              type="number"
              min={64}
              max={2048}
              step={64}
              value={(nodeConfig?.width as number) ?? 512}
              onChange={(e) => updateConfig('width', parseInt(e.target.value) || 512)}
            />
          </Field>
          <Field label="Height">
            <input
              className="orch-input"
              type="number"
              min={64}
              max={2048}
              step={64}
              value={(nodeConfig?.height as number) ?? 512}
              onChange={(e) => updateConfig('height', parseInt(e.target.value) || 512)}
            />
          </Field>
          <Field label="CFG Scale">
            <input
              className="orch-input"
              type="number"
              min={1}
              max={30}
              step={0.5}
              value={(nodeConfig?.cfgScale as number) ?? 7.5}
              onChange={(e) => updateConfig('cfgScale', parseFloat(e.target.value) || 7.5)}
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'model.video') {
      return (
        <>
          <Field label="Model ID">
            <input
              className="orch-input"
              value={(nodeConfig?.modelId as string) ?? ''}
              onChange={(e) => updateConfig('modelId', e.target.value)}
              placeholder="e.g. svd"
            />
          </Field>
          <Field label="Prompt">
            <textarea
              className="orch-textarea"
              rows={3}
              value={(nodeConfig?.prompt as string) ?? ''}
              onChange={(e) => updateConfig('prompt', e.target.value)}
              placeholder="Describe the video..."
            />
          </Field>
          <Field label="Frames">
            <input
              className="orch-input"
              type="number"
              min={1}
              max={256}
              value={(nodeConfig?.frames as number) ?? 16}
              onChange={(e) => updateConfig('frames', parseInt(e.target.value) || 16)}
            />
          </Field>
          <Field label="FPS">
            <input
              className="orch-input"
              type="number"
              min={1}
              max={60}
              value={(nodeConfig?.fps as number) ?? 20}
              onChange={(e) => updateConfig('fps', parseInt(e.target.value) || 20)}
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'model.audio.tts') {
      return (
        <>
          <Field label="Text">
            <textarea
              className="orch-textarea"
              rows={3}
              value={(nodeConfig?.text as string) ?? ''}
              onChange={(e) => updateConfig('text', e.target.value)}
              placeholder="Text to synthesize..."
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'output.note') {
      return (
        <Field label="Note text">
          <textarea
            className="orch-textarea"
            rows={3}
            value={(nodeConfig?.note as string) ?? ''}
            onChange={(e) => updateConfig('note', e.target.value)}
            placeholder="Write a note..."
          />
        </Field>
      );
    }

    if (nodeType === 'output.toast') {
      return (
        <>
          <Field label="Toast message">
            <textarea
              className="orch-textarea"
              rows={3}
              value={(nodeConfig?.message as string) ?? ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              placeholder="e.g. Task complete! Check the results."
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Use {'{{'}nodeId.field{'}}'} to reference upstream outputs, e.g. {'{{'}node-abc.text{'}}'}
          </div>
        </>
      );
    }

    if (nodeType === 'output.file') {
      return (
        <>
          <Field label="Filename">
            <input
              className="orch-input"
              value={(nodeConfig?.filename as string) ?? 'results.json'}
              onChange={(e) => updateConfig('filename', e.target.value)}
              placeholder="e.g. results.json"
            />
          </Field>
          <Field label="Format">
            <select
              className="orch-select"
              value={(nodeConfig?.format as string) ?? 'json'}
              onChange={(e) => updateConfig('format', e.target.value)}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </Field>
          <Field label="Data selector (optional)">
            <input
              className="orch-input"
              value={(nodeConfig?.dataSelector as string) ?? ''}
              onChange={(e) => updateConfig('dataSelector', e.target.value)}
              placeholder="e.g. node-abc.text"
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Leave data selector empty to save the full workflow output.
          </div>
        </>
      );
    }

    if (nodeType === 'output.database') {
      return (
        <>
          <Field label="Label">
            <input
              className="orch-input"
              value={(nodeConfig?.label as string) ?? ''}
              onChange={(e) => updateConfig('label', e.target.value)}
              placeholder="e.g. My saved result"
            />
          </Field>
          <Field label="Data selector (optional)">
            <input
              className="orch-input"
              value={(nodeConfig?.dataSelector as string) ?? ''}
              onChange={(e) => updateConfig('dataSelector', e.target.value)}
              placeholder="e.g. node-abc.text"
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Saves to the workflow results collection. Leave selector empty to save full output.
          </div>
        </>
      );
    }

    if (nodeType === 'skill') {
      const selectedSkillDef = skills.find((s) => s.id === (nodeConfig?.skillId as string));
      return (
        <>
          <Field label="Skill">
            <select
              className="orch-select"
              value={(nodeConfig?.skillId as string) ?? ''}
              onChange={(e) => updateConfig('skillId', e.target.value)}
            >
              <option value="">Select skill…</option>
              {skills.filter((s) => s.enabled).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {selectedSkillDef?.endpoint && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', wordBreak: 'break-all' }}>
              URL template: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selectedSkillDef.endpoint}</span>
            </div>
          )}
          <Field label="Input (JSON for URL placeholders + POST body)">
            <textarea
              key={`${selectedNode?.id}-${String(nodeConfig?.skillId ?? '')}`}
              className="orch-textarea"
              rows={8}
              defaultValue={JSON.stringify((nodeConfig?.input as Record<string, unknown>) ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || '{}') as Record<string, unknown>;
                  updateConfig('input', parsed);
                } catch {
                  /* wait for valid JSON */
                }
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'trigger.schedule') {
      return (
        <Field label="Cron expression">
          <input
            className="orch-input"
            value={(nodeConfig?.cron as string) ?? ''}
            onChange={(e) => updateConfig('cron', e.target.value)}
            placeholder="e.g. 0 6 * * *"
          />
        </Field>
      );
    }

    // ─── New node type config forms ────────────────────────────────────────

    if (nodeType === 'logic.branch') {
      return (
        <>
          <Field label="Condition (JS expression)">
            <textarea
              className="orch-textarea"
              rows={3}
              value={(nodeConfig?.condition as string) ?? ''}
              onChange={(e) => updateConfig('condition', e.target.value)}
              placeholder="e.g. output.text.length > 100"
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Use {'{{'}nodeId.field{'}}'} to reference upstream outputs. If true, follows the first output; otherwise the second.
          </div>
        </>
      );
    }

    if (nodeType === 'logic.loop') {
      return (
        <>
          <Field label="Iterable (JSON array)">
            <textarea
              className="orch-textarea"
              rows={3}
              value={JSON.stringify((nodeConfig?.iterable as unknown[]) ?? [], null, 2)}
              onChange={(e) => {
                try { updateConfig('iterable', JSON.parse(e.target.value || '[]')); } catch {/* ignore */}
              }}
              placeholder='["item1", "item2", "item3"]'
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
          <Field label="Max iterations">
            <input
              className="orch-input"
              type="number"
              min={1}
              max={1000}
              value={(nodeConfig?.maxIterations as number) ?? 10}
              onChange={(e) => updateConfig('maxIterations', parseInt(e.target.value) || 10)}
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'logic.transform') {
      return (
        <>
          <Field label="Transform expression (JS)">
            <textarea
              className="orch-textarea"
              rows={4}
              value={(nodeConfig?.expression as string) ?? ''}
              onChange={(e) => updateConfig('expression', e.target.value)}
              placeholder="e.g. (input) => ({ result: input.toUpperCase() })"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Receives upstream data as `input` parameter. Return transformed data.
          </div>
        </>
      );
    }

    if (nodeType === 'logic.merge') {
      return (
        <>
          <Field label="Merge strategy">
            <select className="orch-select" value={(nodeConfig?.strategy as string) ?? 'concat'} onChange={(e) => updateConfig('strategy', e.target.value)}>
              <option value="concat">Concatenate</option>
              <option value="merge">Deep merge</option>
              <option value="first">Use first</option>
              <option value="last">Use last</option>
            </select>
          </Field>
        </>
      );
    }

    if (nodeType === 'output.email') {
      return (
        <>
          <Field label="To">
            <input className="orch-input" value={(nodeConfig?.to as string) ?? ''} onChange={(e) => updateConfig('to', e.target.value)} placeholder="user@example.com" />
          </Field>
          <Field label="Subject">
            <input className="orch-input" value={(nodeConfig?.subject as string) ?? ''} onChange={(e) => updateConfig('subject', e.target.value)} placeholder="Workflow result" />
          </Field>
          <Field label="Body template">
            <textarea
              className="orch-textarea"
              rows={4}
              value={(nodeConfig?.body as string) ?? ''}
              onChange={(e) => updateConfig('body', e.target.value)}
              placeholder="The workflow completed with result: {{node-abc.text}}"
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'utility.comment') {
      return (
        <Field label="Comment text">
          <textarea
            className="orch-textarea"
            rows={4}
            value={(nodeConfig?.text as string) ?? ''}
            onChange={(e) => updateConfig('text', e.target.value)}
            placeholder="Use this node to document your workflow logic..."
          />
        </Field>
      );
    }

    if (nodeType === 'utility.subworkflow') {
      return (
        <>
          <Field label="Workflow">
            <select className="orch-select" value={(nodeConfig?.workflowId as string) ?? ''} onChange={(e) => updateConfig('workflowId', e.target.value)}>
              <option value="">Select workflow…</option>
              {allWorkflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Input mapping (JSON)">
            <textarea
              className="orch-textarea"
              rows={3}
              value={JSON.stringify((nodeConfig?.inputMapping as Record<string, unknown>) ?? {}, null, 2)}
              onChange={(e) => {
                try { updateConfig('inputMapping', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
        </>
      );
    }

    if (nodeType === 'utility.http') {
      const method = (nodeConfig?.method as string) ?? 'GET';
      return (
        <>
          <Field label="URL">
            <input className="orch-input" value={(nodeConfig?.url as string) ?? ''} onChange={(e) => updateConfig('url', e.target.value)} placeholder="https://api.example.com/data" />
          </Field>
          <Field label="Method">
            <select className="orch-select" value={method} onChange={(e) => updateConfig('method', e.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </Field>
          {method !== 'GET' && (
            <Field label="Body (JSON)">
              <textarea
                className="orch-textarea"
                rows={4}
                value={JSON.stringify((nodeConfig?.body as Record<string, unknown>) ?? {}, null, 2)}
                onChange={(e) => {
                  try { updateConfig('body', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
                }}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
              />
            </Field>
          )}
          <Field label="Headers (JSON)">
            <textarea
              className="orch-textarea"
              rows={3}
              value={JSON.stringify((nodeConfig?.headers as Record<string, string>) ?? {}, null, 2)}
              onChange={(e) => {
                try { updateConfig('headers', JSON.parse(e.target.value || '{}')); } catch {/* ignore */}
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
            />
          </Field>
        </>
      );
    }

    // Generic fallback: show all config keys as editable fields
    if (nodeConfig && Object.keys(nodeConfig).length > 0) {
      const keys = Object.keys(nodeConfig).filter(
        (k) => !['originalClassType', 'originalInputs', 'originalNodeType', 'originalTypeVersion', 'originalParameters'].includes(k),
      );
      return (
        <>
          {keys.map((key) => {
            const val = nodeConfig[key];
            return (
              <Field key={key} label={key}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    className="orch-input"
                    value={String(val ?? '')}
                    onChange={(e) => updateConfig(key, e.target.value)}
                  />
                  <button
                    className="orch-icon-btn"
                    title={`Remove ${key}`}
                    onClick={() => removeConfigKey(key)}
                    style={{ flexShrink: 0, fontSize: 14, color: 'var(--text-3)' }}
                  >
                    ✕
                  </button>
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
              // Replace all config with the parsed value
              if (selectedNode) {
                onNodesChange((nds) =>
                  nds.map((n) =>
                    n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, config: parsed } }
                      : n,
                  ),
                );
              }
            } catch { /* invalid JSON - don't update */ }
          }}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
        />
      </Field>
    );
  };

  return (
    <div className="orch-card" style={{ height: 'fit-content' }}>
      <div className="orch-card-header">
        <div className="orch-card-title">Inspector</div>
        <span className="orch-chip purple">{workflow.name}</span>
      </div>
      <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {selectedNode ? (
          <>
            <Field label="Node label">
              <input
                className="orch-input"
                value={selectedNode.data.label as string}
                onChange={(e) => updateNodeLabel(e.target.value)}
              />
            </Field>
            <Field label="Type">
              <input className="orch-input" value={selectedNode.data.nodeType as string} readOnly />
            </Field>
            {renderConfigFields()}
          </>
        ) : (
          <div style={{ color: 'var(--text-2)', fontSize: 13, textAlign: 'center', padding: 16 }}>
            Select a node to inspect its properties
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="orch-btn primary" style={{ flex: 1 }} onClick={onRun}><Play />Run</button>
          <button className="orch-btn" onClick={onSave} disabled={saving}><Save size={14} />{saving ? 'Saving...' : 'Save'}</button>
          <button className="orch-btn" onClick={onExport}><Download size={14} />Export</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
          {nodes.length} nodes · {edges.length} connections
        </div>
      </div>
    </div>
  );
}

// ─── Marketplace / Categories / Workflow List ───────────────────────────────

function MarketplaceWorkflowsList({
  workflows,
  onInstall,
}: {
  workflows: { id: string; name: string; category: string; description: string; nodeCount: number }[];
  onInstall: (id: string) => void;
}) {
  return (
    <div className="orch-card">
      <div className="orch-card-header">
        <div className="orch-card-title"><Globe size={14} />Marketplace</div>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{workflows.length} available</span>
      </div>
      <table className="orch-table">
        <thead>
          <tr>
            <th>Workflow</th>
            <th>Category</th>
            <th>Nodes</th>
            <th>Description</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {workflows.map((workflow) => (
            <tr key={workflow.id}>
              <td><strong style={{ fontSize: 12.5 }}>{workflow.name}</strong></td>
              <td><span className="orch-chip blue">{workflow.category}</span></td>
              <td>{workflow.nodeCount}</td>
              <td style={{ color: 'var(--text-2)', fontSize: 12.5 }}>{workflow.description}</td>
              <td><button className="orch-btn xs" onClick={() => onInstall(workflow.id)}>Install</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowCategoriesView({
  categoryCounts,
  onSelect,
}: {
  categoryCounts: Map<string, number>;
  onSelect: (category: string) => void;
}) {
  return (
    <div className="orch-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
      {Array.from(categoryCounts.entries()).map(([category, count]) => (
        <div
          className="orch-card"
          key={category}
          style={{ padding: 20, cursor: 'pointer' }}
          onClick={() => onSelect(category)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="orch-chip blue">{category}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>{count}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>
            {count} workflow{count !== 1 ? 's' : ''} installed
          </div>
        </div>
      ))}
      {categoryCounts.size === 0 && (
        <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
          No workflows installed yet.
        </div>
      )}
    </div>
  );
}

function AllWorkflowsList({
  workflows, categoryFilter, categories, onCategoryChange, onEdit, onRun, onExport, onImport,
}: {
  workflows: WorkflowType[];
  categoryFilter: string;
  categories: string[];
  onCategoryChange: (category: string) => void;
  onEdit: (id: string) => void;
  onRun: (id: string) => void;
  onExport: (wf: WorkflowType) => void;
  onImport: () => void;
}) {

  if (workflows.length === 0) {
    return (
      <div className="orch-card" style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--text-2)' }}>
        <div style={{ marginBottom: 16, fontWeight: 600 }}>No workflows match this category</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="orch-btn" onClick={onImport}><Upload size={14} />Import JSON</button>
        </div>
      </div>
    );
  }

  return (
    <div className="orch-card">
      <div className="orch-card-header">
        <div className="orch-card-title"><Workflow size={14} />Installed workflows</div>
        <select className="orch-select" value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)} style={{ width: 190 }}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
      </div>
      <div className="orch-list">
        {workflows.map((wf) => (
          <div className="orch-row" key={wf.id}>
            <div className="orch-row-icon"><Workflow size={14} /></div>
            <div className="orch-row-main">
              <div className="orch-row-title">
                {wf.name}
                <span className="orch-chip blue" style={{ marginLeft: 6 }}>{workflowCategory(wf)}</span>
                <span className={`orch-chip ${wf.enabled ? 'green' : 'amber'}`} style={{ marginLeft: 6 }}>{wf.enabled ? 'enabled' : 'paused'}</span>
                {wf.description.startsWith('Converted from') && (
                  <span className="orch-chip purple" style={{ marginLeft: 4 }}>converted</span>
                )}
              </div>
              <div className="orch-row-sub">{wf.description}</div>
            </div>
            <button className="orch-btn xs" onClick={() => onRun(wf.id)}><Play size={12} />Run</button>
            <button className="orch-btn xs ghost" onClick={() => onEdit(wf.id)}>Edit</button>
            <button className="orch-icon-btn" title="Export" onClick={() => onExport(wf)}><Download size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Runs list (with auto-refresh) ────────────────────────────────────────────

function RunListWithPolling() {
  const { workflowRuns, loadAll } = useOrchestrationStore();
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  // Poll every 5 seconds while the runs tab is active
  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  return (
    <div className="orch-grid" style={{ gridTemplateColumns: selectedRun ? '1fr 320px' : '1fr', gap: 14 }}>
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">Run history</div>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {workflowRuns.length} total · auto-refreshing
          </span>
        </div>
        <div className="orch-list">
          {workflowRuns.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>No runs yet. Click "Run" in the editor to start one.</div>
          )}
          {workflowRuns.map((run) => (
            <div
              className="orch-row"
              key={run.id}
              onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              style={selectedRun?.id === run.id ? { background: 'var(--bg-3)' } : undefined}
            >
              <div className="orch-row-icon"><Play size={14} /></div>
              <div className="orch-row-main">
                <div className="orch-row-title">
                  {run.workflowName}
                  <span className={`orch-chip ${run.status === 'failed' ? 'red' : run.status === 'completed' ? 'green' : 'amber'}`} style={{ marginLeft: 6 }}>{run.status}</span>
                </div>
                <div className="orch-row-sub">{run.error ?? `Triggered by ${run.trigger}`}</div>
              </div>
              <div className="orch-row-meta">{new Date(run.startedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {selectedRun && (
        <div className="orch-card" style={{ height: 'fit-content' }}>
          <div className="orch-card-header">
            <div className="orch-card-title">Run details</div>
            <span className={`orch-chip ${selectedRun.status === 'failed' ? 'red' : selectedRun.status === 'completed' ? 'green' : 'amber'}`}>
              {selectedRun.status}
            </span>
          </div>
          <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Workflow">
              <input className="orch-input" value={selectedRun.workflowName} readOnly />
            </Field>
            <Field label="Trigger">
              <input className="orch-input" value={selectedRun.trigger} readOnly />
            </Field>
            <Field label="Started">
              <input className="orch-input" value={new Date(selectedRun.startedAt).toLocaleString()} readOnly />
            </Field>
            {selectedRun.completedAt && (
              <Field label="Completed">
                <input className="orch-input" value={new Date(selectedRun.completedAt).toLocaleString()} readOnly />
              </Field>
            )}
            {selectedRun.error && (
              <Field label="Error">
                <textarea className="orch-textarea" rows={3} value={selectedRun.error} readOnly style={{ color: 'var(--red)' }} />
              </Field>
            )}
            {selectedRun.output && Object.keys(selectedRun.output).length > 0 && (
              <Field label="Output">
                <textarea
                  className="orch-textarea"
                  rows={8}
                  value={JSON.stringify(selectedRun.output, null, 2)}
                  readOnly
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Triggers view (webhooks + schedule triggers) ─────────────────────────────

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function TriggersView() {
  const { workflows, loadAll, pushToast } = useOrchestrationStore();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [tasks, setTasks] = useState<{ id: string; name: string; workflowId?: string; cron: string; enabled: boolean; nextRunAt?: string; lastStatus?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formWorkflowId, setFormWorkflowId] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [whRes, tasksRes] = await Promise.all([
        fetch('/api/webhooks'),
        fetch('/api/tasks'),
      ]);
      if (whRes.ok) {
        const whData = await whRes.json();
        setWebhooks(whData.data ?? []);
      }
      if (tasksRes.ok) {
        const tData = await tasksRes.json();
        setTasks(tData.data ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Poll tasks for schedule updates every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
          const d = await res.json();
          setTasks(d.data ?? []);
        }
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const createWebhook = useCallback(async () => {
    if (!formName || !formWorkflowId) return;
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          workflowId: formWorkflowId,
          token: generateToken(),
          enabled: true,
        }),
      });
      if (res.ok) {
        pushToast(`Webhook "${formName}" created`);
        setShowForm(false);
        setFormName('');
        setFormWorkflowId('');
        fetchAll();
        loadAll();
      } else {
        pushToast('Failed to create webhook');
      }
    } catch {
      pushToast('Failed to create webhook');
    }
  }, [formName, formWorkflowId, pushToast, fetchAll, loadAll]);

  const toggleWebhook = useCallback(async (wh: Webhook) => {
    try {
      const res = await fetch(`/api/webhooks/${wh.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...wh, enabled: !wh.enabled }),
      });
      if (res.ok) {
        setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? { ...w, enabled: !wh.enabled } : w)));
      }
    } catch { /* ignore */ }
  }, []);

  const deleteWebhook = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
        pushToast('Webhook deleted');
      }
    } catch { /* ignore */ }
  }, [pushToast]);

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/api/webhooks/trigger/${token}`;
    navigator.clipboard.writeText(url).then(() => pushToast('Webhook URL copied')).catch(() => {});
  };

  const runningTaskCount = tasks.filter((t) => t.enabled).length;

  if (loading) {
    return <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading triggers...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Webhooks */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title"><Globe size={14} />Webhooks</div>
          <button className="orch-btn primary sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={12} />{showForm ? 'Cancel' : 'Add webhook'}
          </button>
        </div>

        {showForm && (
          <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border-c)' }}>
            <Field label="Webhook name">
              <input className="orch-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. GitHub push" />
            </Field>
            <Field label="Workflow">
              <select className="orch-select" value={formWorkflowId} onChange={(e) => setFormWorkflowId(e.target.value)}>
                <option value="">Select a workflow...</option>
                {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <div>
              <button className="orch-btn primary" onClick={createWebhook} disabled={!formName || !formWorkflowId}>
                <Plus size={12} />Create webhook
              </button>
            </div>
          </div>
        )}

        <div className="orch-list">
          {webhooks.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
              No webhooks configured. Create one to trigger a workflow via HTTP POST.
            </div>
          )}
          {webhooks.map((wh) => {
            const wf = workflows.find((w) => w.id === wh.workflowId);
            return (
              <div className="orch-row" key={wh.id}>
                <div className="orch-row-icon"><Globe size={14} /></div>
                <div className="orch-row-main">
                  <div className="orch-row-title">
                    {wh.name}
                    <span className={`orch-chip ${wh.enabled ? 'green' : 'amber'}`} style={{ marginLeft: 6 }}>
                      {wh.enabled ? 'active' : 'disabled'}
                    </span>
                  </div>
                  <div className="orch-row-sub">
                    Triggers: {wf?.name ?? '(deleted workflow)'}
                    {wh.lastTriggeredAt && <span>· Last triggered: {new Date(wh.lastTriggeredAt).toLocaleString()}</span>}
                  </div>
                </div>
                {wh.enabled && (
                  <button className="orch-btn xs" onClick={() => copyUrl(wh.token)} title="Copy webhook URL">
                    Copy URL
                  </button>
                )}
                <button className="orch-btn xs ghost" onClick={() => toggleWebhook(wh)}>
                  {wh.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="orch-icon-btn" title="Delete" onClick={() => deleteWebhook(wh.id)} style={{ color: 'var(--text-3)' }}>✕</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Triggers */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title"><Clock size={14} />Schedule triggers</div>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {runningTaskCount} active · auto-refreshing
          </span>
        </div>
        <div className="orch-list">
          {tasks.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
              No schedule triggers configured. Create one via the Tasks panel.
            </div>
          )}
          {tasks.map((task) => {
            const wf = workflows.find((w) => w.id === task.workflowId);
            return (
              <div className="orch-row" key={task.id}>
                <div className="orch-row-icon"><Clock size={14} /></div>
                <div className="orch-row-main">
                  <div className="orch-row-title">
                    {task.name}
                    <span className={`orch-chip ${task.enabled ? 'green' : 'amber'}`} style={{ marginLeft: 6 }}>
                      {task.enabled ? 'active' : 'paused'}
                    </span>
                    {task.lastStatus && (
                      <span className={`orch-chip ${task.lastStatus === 'failed' ? 'red' : task.lastStatus === 'completed' ? 'green' : 'amber'}`} style={{ marginLeft: 4 }}>
                        {task.lastStatus}
                      </span>
                    )}
                  </div>
                  <div className="orch-row-sub">
                    <span className="orch-code">{task.cron}</span>
                    {wf?.name && <> · {wf.name}</>}
                    {task.nextRunAt && <> · Next: {new Date(task.nextRunAt).toLocaleString()}</>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Versions view ─────────────────────────────────────────────────────────────

function VersionsView({ workflowId }: { workflowId: string }) {
  const { pushToast } = useOrchestrationStore();
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.data ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [workflowId]);

  useEffect(() => {
    setLoading(true);
    fetchVersions();
  }, [fetchVersions]);

  const snapshot = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message || undefined }),
      });
      if (res.ok) {
        pushToast('Version snapshot saved');
        setShowSnapshotForm(false);
        setMessage('');
        fetchVersions();
      } else {
        pushToast('Failed to create snapshot');
      }
    } catch {
      pushToast('Failed to create snapshot');
    }
    setSaving(false);
  }, [workflowId, message, saving, pushToast, fetchVersions]);

  const restore = useCallback(async (versionId: string, versionNumber: number) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions/${versionId}/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        pushToast(`Restored to v${versionNumber}`);
      } else {
        pushToast('Failed to restore version');
      }
    } catch {
      pushToast('Failed to restore version');
    }
  }, [workflowId, pushToast]);

  if (loading) {
    return <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading versions...</div>;
  }

  return (
    <div className="orch-card">
      <div className="orch-card-header">
        <div className="orch-card-title"><Clock size={14} />Version history</div>
        <button className="orch-btn primary sm" onClick={() => setShowSnapshotForm(!showSnapshotForm)}>
          <Plus size={12} />{showSnapshotForm ? 'Cancel' : 'Snapshot'}
        </button>
      </div>

      {showSnapshotForm && (
        <div className="orch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border-c)' }}>
          <Field label="Message (optional)">
            <input
              className="orch-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Added image gen node"
            />
          </Field>
          <div>
            <button className="orch-btn primary" onClick={snapshot} disabled={saving}>
              <Save size={12} />{saving ? 'Saving...' : 'Save snapshot'}
            </button>
          </div>
        </div>
      )}

      <div className="orch-list">
        {versions.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
            No versions saved. Click "Snapshot" to save the current state of this workflow.
          </div>
        )}
        {versions.map((v, index) => (
          <div className="orch-row" key={v.id}>
            <div className="orch-row-icon"><Clock size={14} /></div>
            <div className="orch-row-main">
              <div className="orch-row-title">
                v{v.versionNumber ?? v.version}
                {index === 0 && <span className="orch-chip green" style={{ marginLeft: 6 }}>latest</span>}
              </div>
              <div className="orch-row-sub">
                {new Date(v.createdAt).toLocaleString()}
                {v.message && <span> · {v.message}</span>}
              </div>
            </div>
            <button
              className="orch-btn xs"
              onClick={() => restore(v.id, v.versionNumber ?? v.version)}
              title="Restore this version"
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Palette helpers ──────────────────────────────────────────────────────────

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', padding: '8px 4px 4px' }}>{title}</div>
      {children}
    </>
  );
}

// ─── Shared Field ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{label}</label>
      {children}
    </div>
  );
}