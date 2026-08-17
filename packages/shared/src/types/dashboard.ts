// ============================================
// Dashboard Types
// ============================================

import type { ActivityEvent } from './activity.js';
import type { WorkflowRun } from './workflows.js';

export interface DashboardSummary {
  agents: {
    total: number;
    active: number;
  };
  workflows: {
    total: number;
    runs24h: number;
    running: number;
  };
  tasks: {
    total: number;
    enabled: number;
    nextRunAt?: string;
  };
  skills: {
    total: number;
    enabled: number;
  };
  runtimes: {
    total: number;
    connected: number;
    models: number;
  };
  activity: ActivityEvent[];
  recentRuns: WorkflowRun[];
}