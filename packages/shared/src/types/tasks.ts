// ============================================
// Task Types
// ============================================

import type { JobStatus } from './jobs.js';

export interface TaskSchedule {
  id: string;
  name: string;
  workflowId?: string;
  agentId?: string;
  cron: string;
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: JobStatus;
  createdAt: string;
  updatedAt: string;
}