// ============================================
// Workflow Types
// ============================================

import type { JobStatus } from './jobs.js';

export type WorkflowNodeType =
  | 'trigger.schedule'
  | 'trigger.manual'
  | 'model.text'
  | 'model.image'
  | 'model.video'
  | 'model.audio.tts'
  | 'model.audio.stt'
  | 'skill'
  | 'output.note'
  | 'output.file'
  | 'output.database'
  | 'output.toast'
  | 'output.email'
  | 'logic.branch'
  | 'logic.loop'
  | 'logic.transform'
  | 'logic.merge'
  | 'utility.comment'
  | 'utility.subworkflow'
  | 'utility.http';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  project: string;
  category: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: JobStatus;
  trigger: 'manual' | 'schedule' | 'task';
  startedAt: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  toastMessages?: string[];
  costEstimate?: {
    provider: string;
    estimatedCost: number;
    currency: string;
  };
}

export interface WorkflowResult {
  id: string;
  workflowId: string;
  workflowName: string;
  runId: string;
  label: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  versionNumber?: number;
  message?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
}