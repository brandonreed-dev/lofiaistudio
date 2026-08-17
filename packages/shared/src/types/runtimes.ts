// ============================================
// Runtime Status Types
// ============================================

import type { Model } from './models.js';
import type { RuntimeType } from './modality.js';

export interface RuntimeStatus {
  type: RuntimeType;
  connected: boolean;
  endpoint: string;
  version?: string;
  vramUsage?: number;
  vramTotal?: number;
  models: Model[];
}