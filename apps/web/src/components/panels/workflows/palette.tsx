import type React from 'react';
import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import {
  Bell,
  BookOpen,
  Clock,
  Code2,
  Cpu,
  Database,
  GitBranch,
  GitMerge,
  Globe,
  Image as ImageIcon,
  Layers,
  Mail,
  Mic2,
  Play,
  Repeat,
  Save,
} from 'lucide-react';

export type PaletteColor = 'trigger' | 'model' | 'skill' | 'logic' | 'output' | 'utility';

export const NODE_TYPE_COLOR: Record<string, PaletteColor> = {
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

export interface PaletteItem {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}

export const PALETTE_COLORS: Record<PaletteColor, string> = {
  trigger: '#28a745',
  model: '#e83e8c',
  skill: '#6f42c1',
  logic: '#0dcaf0',
  output: '#ffc658',
  utility: '#6c757d',
};

export const NODE_TYPE_ICON: Record<string, string> = {
  'trigger.schedule': 'clock',
  'trigger.manual': 'play',
  'model.text': 'text',
  'model.image': 'image',
  'model.video': 'video',
  'model.audio.tts': 'tts',
  'model.audio.stt': 'stt',
  skill: 'skill',
  'output.note': 'note',
  'output.toast': 'toast',
  'output.file': 'file',
  'output.database': 'db',
  'output.email': 'mail',
  'logic.branch': 'if',
  'logic.loop': 'loop',
  'logic.transform': 'fx',
  'logic.merge': 'merge',
  'utility.comment': 'comment',
  'utility.subworkflow': 'sub',
  'utility.http': 'http',
};

export const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'trigger.manual', label: 'Manual Trigger', icon: <Play size={13} />, color: '#28a745', category: 'Triggers' },
  { type: 'trigger.schedule', label: 'Schedule (Cron)', icon: <Clock size={13} />, color: '#28a745', category: 'Triggers' },
  { type: 'model.text', label: 'Text LLM', icon: <Cpu size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.image', label: 'Image Gen', icon: <ImageIcon size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.video', label: 'Video Gen', icon: <Play size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.audio.tts', label: 'Voice Synthesizer', icon: <Mic2 size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'model.audio.stt', label: 'Speech-to-Text', icon: <Mic2 size={13} />, color: '#e83e8c', category: 'AI Models' },
  { type: 'logic.branch', label: 'Branch/Conditional', icon: <GitBranch size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'logic.loop', label: 'Loop/Foreach', icon: <Repeat size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'logic.transform', label: 'Transform', icon: <Code2 size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'logic.merge', label: 'Merge/Join', icon: <GitMerge size={13} />, color: '#0dcaf0', category: 'Logic' },
  { type: 'output.toast', label: 'Toast Notification', icon: <Bell size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.note', label: 'Note', icon: <BookOpen size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.file', label: 'Save to File', icon: <Save size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.database', label: 'Save to Database', icon: <Database size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'output.email', label: 'Email', icon: <Mail size={13} />, color: '#ffc658', category: 'Outputs' },
  { type: 'utility.comment', label: 'Comment', icon: <BookOpen size={13} />, color: '#6c757d', category: 'Utility' },
  { type: 'utility.subworkflow', label: 'Sub-workflow', icon: <Layers size={13} />, color: '#6c757d', category: 'Utility' },
  { type: 'utility.http', label: 'HTTP Request', icon: <Globe size={13} />, color: '#6c757d', category: 'Utility' },
];

export const PALETTE_CATEGORIES = ['Triggers', 'AI Models', 'Skills', 'Logic', 'Outputs', 'Utility'];

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const headColor = data.nodeType ? (NODE_TYPE_COLOR[data.nodeType as string] ?? 'skill') : 'skill';
  return (
    <div className={`orch-node${selected ? ' selected' : ''}`} style={{ width: 180, position: 'relative' }}>
      <div className={`orch-node-head ${headColor}`}>
        <span style={{ fontSize: 11, opacity: 0.7 }}>{NODE_TYPE_ICON[data.nodeType as string] ?? 'skill'}</span>
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

export const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent,
};
