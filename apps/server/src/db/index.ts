import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import type { Agent, Project as StudioProject, ChatSession, ChatMessage } from '@lofiaistudio/shared';
import { createLoFiAIStudioProject, LOFIAISTUDIO_PROJECT_ID } from '../seed/lofiaistudio-project.js';

// Get the config directory
const CONFIG_DIR = process.env.LOFIAISTUDIO_CONFIG_DIR || join(homedir(), '.lofiaistudio');
const DB_PATH = join(CONFIG_DIR, 'lofiaistudio.json');

// Ensure config directory exists
if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

// Simple JSON file-based storage
interface Database {
  settings: Record<string, unknown>;
  jobs: Record<string, unknown>[];
  chatSessions: Record<string, unknown>[];
  chatMessages: Record<string, unknown>[];
  runtimeConnections: Record<string, unknown>;
  cloudProviders: unknown[];
  usageLog: unknown[];
  agents: Record<string, unknown>[];
  workflows: Record<string, unknown>[];
  workflowRuns: Record<string, unknown>[];
  workflowResults: Record<string, unknown>[];
  skills: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  integrations: Record<string, unknown>[];
  webhooks: Record<string, unknown>[];
  workflowVersions: Record<string, unknown>[];
  chatFolders: Record<string, unknown>[];
  inboxAccounts: Record<string, unknown>[];
  inboxMessages: Record<string, unknown>[];
  organizations: Record<string, unknown>[];
  organizationMembers: Record<string, unknown>[];
}

const defaultDatabase: Database = {
  settings: {},
  jobs: [],
  chatSessions: [],
  chatMessages: [],
  runtimeConnections: {},
  cloudProviders: [],
  usageLog: [],
  agents: [],
  workflows: [],
  workflowRuns: [],
  workflowResults: [],
  skills: [],
  tasks: [],
  activity: [],
  projects: [],
  integrations: [],
  webhooks: [],
  workflowVersions: [],
  chatFolders: [],
  inboxAccounts: [],
  inboxMessages: [],
  organizations: [],
  organizationMembers: [],
};

type CollectionName =
  | 'agents'
  | 'workflows'
  | 'workflowRuns'
  | 'workflowResults'
  | 'skills'
  | 'tasks'
  | 'activity'
  | 'projects'
  | 'integrations'
  | 'webhooks'
  | 'chatSessions'
  | 'chatMessages'
  | 'chatFolders'
  | 'cloudProviders'
  | 'inboxAccounts'
  | 'inboxMessages'
  | 'organizations'
  | 'organizationMembers';

function loadDatabase(): Database {
  try {
    if (existsSync(DB_PATH)) {
      const data = readFileSync(DB_PATH, 'utf-8');
      return { ...defaultDatabase, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load database:', error);
  }
  return { ...defaultDatabase };
}

export function saveDatabase(db: Database): void {
  try {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

function now(): string {
  return new Date().toISOString();
}

const JAYNE_AGENT_PROMPT =
  'You are the spokesperson for LoFi AI Studio, and the entry point for users to begin interacting with. Have a friendly but professional attitude and vibe. Be knowledgeable and helpful.';

function createJayneAgent(createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-jayne',
    name: 'JAYNE',
    role: 'LoFiAI Studio spokesperson',
    model: 'gemma4:e4b',
    systemPrompt: JAYNE_AGENT_PROMPT,
    status: 'active',
    project: 'Internal',
    avatar: 'J',
    colorA: '#00d4ff',
    colorB: '#7c5cff',
    skillIds: [],
    workflowIds: [],
    runCount: 0,
    capabilities: {
      skillRead: false,
      skillCreate: false,
      skillUpdate: false,
      skillDelete: false,
    },
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createDefaults() {
  const createdAt = now();
  const agents = [createJayneAgent(createdAt)];

  /** Default skills for empty DB only; portability: HTTP skills use reddit.com URL templates (no LoFi AI-specific proxy). */
  const skills = [
    {
      id: 'skill-reddit-subreddit-top',
      name: 'reddit.subreddit_top',
      category: 'Web',
      description:
        'Top posts in a subreddit. Set Reddit window `t`: day (≈1d), week (≈7d), month (≈30d). URL uses `{subreddit}`, `{t}`, `{limit}` — export/import works on any Studio with network access to reddit.com.',
      usedBy: 0,
      runs7d: 0,
      avgLatency: '—',
      cost: 'Free',
      enabled: true,
      executionType: 'http' as const,
      method: 'GET' as const,
      endpoint: 'https://www.reddit.com/r/{subreddit}/top.json?limit={limit}&t={t}&raw_json=1',
      runInputDefaults: { subreddit: 'gamedev', t: 'week', limit: 25 },
      configSchema: {
        type: 'object',
        properties: {
          subreddit: { type: 'string' },
          t: { type: 'string', description: 'hour | day | week | month | year | all' },
          limit: { type: 'number' },
        },
      },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'skill-reddit-topic-comments',
      name: 'reddit.topic_comments',
      category: 'Web',
      description:
        'Search Reddit comments by topic (query). Uses `{topic}` and `{limit}` in the public search API — portable across Studio installs.',
      usedBy: 0,
      runs7d: 0,
      avgLatency: '—',
      cost: 'Free',
      enabled: true,
      executionType: 'http' as const,
      method: 'GET' as const,
      endpoint: 'https://www.reddit.com/search.json?q={topic}&type=comments&limit={limit}&raw_json=1',
      runInputDefaults: { topic: 'game development', limit: 25 },
      configSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          limit: { type: 'number' },
        },
      },
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const workflows = [
    {
      id: 'workflow-daily-shorts',
      name: 'Daily Shorts Pipeline',
      description: 'Drafts a short concept, generates thumbnail art, and prepares voiceover copy.',
      project: 'AI Clips',
      category: 'Image',
      enabled: true,
      nodes: [
        { id: 'node-trigger', type: 'trigger.schedule', label: 'Schedule trigger', x: 50, y: 60, config: { cron: '0 6 * * *' } },
        { id: 'node-text', type: 'model.text', label: 'LLM concept', x: 350, y: 140, config: { prompt: 'Write a concise AI tools short concept.', temperature: 0.7 } },
        { id: 'node-image', type: 'model.image', label: 'Thumbnail image', x: 650, y: 60, config: { prompt: 'A crisp YouTube thumbnail for a local AI tools channel' } },
        { id: 'node-tts', type: 'model.audio.tts', label: 'Voiceover draft', x: 650, y: 240, config: { text: 'Local AI Studio generated this voiceover draft.' } },
      ],
      edges: [
        { id: 'edge-1', from: 'node-trigger', to: 'node-text' },
        { id: 'edge-2', from: 'node-text', to: 'node-image' },
        { id: 'edge-3', from: 'node-text', to: 'node-tts' },
      ],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'workflow-runtime-check',
      name: 'Runtime Health Check',
      description: 'Records a lightweight local runtime readiness check.',
      project: 'Internal',
      category: 'General',
      enabled: true,
      nodes: [
        { id: 'node-manual', type: 'trigger.manual', label: 'Manual trigger', x: 80, y: 120, config: {} },
        { id: 'node-note', type: 'output.note', label: 'Health note', x: 380, y: 120, config: { note: 'Runtime hub checked.' } },
      ],
      edges: [{ id: 'edge-health', from: 'node-manual', to: 'node-note' }],
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const tasks = [
    { id: 'task-daily-shorts', name: 'Daily Shorts Pipeline', workflowId: 'workflow-daily-shorts', agentId: 'agent-jayne', cron: '0 6 * * *', enabled: true, nextRunAt: new Date(Date.now() + 14 * 60 * 1000).toISOString(), lastStatus: 'completed', createdAt, updatedAt: createdAt },
    { id: 'task-runtime-check', name: 'Runtime check', workflowId: 'workflow-runtime-check', cron: '*/30 * * * *', enabled: true, nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), lastStatus: 'completed', createdAt, updatedAt: createdAt },
  ];

  const projects = [
    { id: 'project-ai-clips', name: 'AI Clips', description: 'Short-form content powered by local models.', status: 'active', createdAt, updatedAt: createdAt },
    { id: 'project-internal', name: 'Internal', description: 'Workspace automation and runtime checks.', status: 'active', createdAt, updatedAt: createdAt },
    createLoFiAIStudioProject(createdAt),
  ];

  const integrations = [
    { id: 'integration-comfyui', name: 'ComfyUI', category: 'Runtime', status: 'connected', createdAt, updatedAt: createdAt },
    { id: 'integration-ollama', name: 'Ollama', category: 'Runtime', status: 'connected', createdAt, updatedAt: createdAt },
    { id: 'integration-qwen3', name: 'Qwen3 Audio Wrapper', category: 'Runtime', status: 'connected', createdAt, updatedAt: createdAt },
  ];

  const activity = [
    { id: 'activity-seed-1', type: 'system.seeded', title: 'MVP workspace initialized', message: 'Seeded agents, workflows, skills, and tasks for the orchestration MVP.', tone: 'green', entityType: 'workspace', createdAt },
    { id: 'activity-seed-2', type: 'runtime.ready', title: 'Runtime hub ready', message: 'Ollama, ComfyUI, and Qwen3 audio endpoints are configured for local-first operation.', tone: 'cyan', entityType: 'runtime', createdAt },
  ];

  return { agents, skills, workflows, tasks, projects, integrations, activity };
}

// In-memory database instance
let db = loadDatabase();

const DEFAULT_CAPABILITIES = {
  skillRead: false,
  skillCreate: false,
  skillUpdate: false,
  skillDelete: false,
  projectRead: false,
  projectWrite: false,
};

// Initialize database with default settings
export function initializeDatabase(): void {
  const defaultSettings = {
    runtimes: {
      ollama: 'http://localhost:11434',
      comfyui: 'http://localhost:8188',
      qwen3Audio: 'http://localhost:8001',
      a1111: 'http://localhost:7860',
    },
    outputDir: join(CONFIG_DIR, 'outputs'),
    theme: 'system',
    cloudProviders: [],
    defaultParams: {
      chat: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        repeatPenalty: 1.1,
        maxTokens: 2048,
      },
      image: {
        steps: 20,
        cfgScale: 7.5,
        sampler: 'euler',
        scheduler: 'normal',
        width: 512,
        height: 512,
        batchSize: 1,
      },
      audio: {
        language: 'auto',
        speed: 1.0,
        pitch: 1.0,
        outputFormat: 'wav',
      },
      video: {
        steps: 15,
        cfgScale: 5,
        sampler: 'uni_pc',
        scheduler: 'simple',
        width: 768,
        height: 512,
        frames: 16,
        fps: 20,
      },
    },
  };

  // Initialize settings if not present
  if (!db.settings.app) {
    db.settings.app = defaultSettings;
    saveDatabase(db);
  }

  const defaults = createDefaults();
  let changed = false;
  for (const [key, value] of Object.entries(defaults) as [CollectionName, Record<string, unknown>[]][]) {
    if (!Array.isArray(db[key]) || db[key].length === 0) {
      db[key] = value;
      changed = true;
    }
  }
  if (changed) {
    saveDatabase(db);
  }

  const existingJayne = db.agents.find((agent) => agent.id === 'agent-jayne');
  if (!existingJayne) {
    db.agents = [createJayneAgent(now()), ...db.agents];
    saveDatabase(db);
  } else if (!('systemPrompt' in existingJayne) || !Array.isArray(existingJayne.skillIds)) {
    db.agents = db.agents.map((agent) =>
      agent.id === 'agent-jayne' ? createJayneAgent(now(), agent) : agent
    );
    saveDatabase(db);
  }

  // Migration: ensure all agents have capabilities field with all keys
  const agentsNeedCapabilities = db.agents.some(
    (agent) => !agent.capabilities || typeof agent.capabilities !== 'object'
  );
  if (agentsNeedCapabilities) {
    db.agents = db.agents.map((agent) => ({
      ...agent,
      capabilities: agent.capabilities && typeof agent.capabilities === 'object'
        ? agent.capabilities
        : { ...DEFAULT_CAPABILITIES },
    }));
    saveDatabase(db);
  } else {
    // Migration: backfill projectRead/projectWrite on agents with older capabilities
    const agentsNeedProjectCaps = db.agents.some(
      (agent) => agent.capabilities && typeof agent.capabilities === 'object' &&
        ((agent.capabilities as Record<string, unknown>).projectRead === undefined ||
         (agent.capabilities as Record<string, unknown>).projectWrite === undefined)
    );
    if (agentsNeedProjectCaps) {
      db.agents = db.agents.map((agent) => {
        if (!agent.capabilities || typeof agent.capabilities !== 'object') return agent;
        const caps = agent.capabilities as Record<string, unknown>;
        return {
          ...agent,
          capabilities: {
            skillRead: caps.skillRead ?? false,
            skillCreate: caps.skillCreate ?? false,
            skillUpdate: caps.skillUpdate ?? false,
            skillDelete: caps.skillDelete ?? false,
            projectRead: caps.projectRead ?? false,
            projectWrite: caps.projectWrite ?? false,
          },
        };
      });
      saveDatabase(db);
    }
  }

  const missingWorkflowCategories = db.workflows.some((workflow) => !workflow.category);
  if (missingWorkflowCategories) {
    db.workflows = db.workflows.map((workflow) => ({
      ...workflow,
      category: typeof workflow.category === 'string' && workflow.category.trim() ? workflow.category : 'General',
    }));
    saveDatabase(db);
  }

  // Migration: ensure the LoFi AI Studio self-referential project exists
  const existingLsProject = db.projects.find(
    (p) => p.id === LOFIAISTUDIO_PROJECT_ID
  ) as Record<string, unknown> | undefined;
  if (!existingLsProject) {
    const lsProject = createLoFiAIStudioProject(now()) as unknown as Record<string, unknown>;
    db.projects.push(lsProject);
    saveDatabase(db);
    console.log('Seeded Lofi AI Studio self-referential project.');
  } else if (!existingLsProject.nodes || !Array.isArray(existingLsProject.nodes) || existingLsProject.nodes.length === 0) {
    // Migration: backfill nodes/edges for upgraded databases that had the old empty project
    const fresh = createLoFiAIStudioProject(now()) as unknown as Record<string, unknown>;
    const idx = db.projects.findIndex((p) => p.id === LOFIAISTUDIO_PROJECT_ID);
    if (idx !== -1) {
      db.projects[idx] = { ...existingLsProject, nodes: fresh.nodes, edges: fresh.edges };
      saveDatabase(db);
    }
  }

  // Ensure output directory exists
  const outputDir = defaultSettings.outputDir;
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Database initialized at: ${DB_PATH}`);
}

// Database operations
export const dbOperations = {
  // Settings
  getSetting: <T>(key: string): T | undefined => {
    return db.settings[key] as T | undefined;
  },
  
  setSetting: (key: string, value: unknown): void => {
    db.settings[key] = value;
    saveDatabase(db);
  },
  
  // Jobs
  getJobs: () => db.jobs,
  
  addJob: (job: Record<string, unknown>) => {
    db.jobs.push(job);
    saveDatabase(db);
  },
  
  updateJob: (id: string, updates: Record<string, unknown>) => {
    const index = db.jobs.findIndex((j: Record<string, unknown>) => j.id === id);
    if (index !== -1) {
      db.jobs[index] = { ...db.jobs[index], ...updates };
      saveDatabase(db);
    }
  },
  
  // Chat sessions
  getChatSessions: () => db.chatSessions,
  
  addChatSession: (session: Record<string, unknown>) => {
    db.chatSessions.push(session);
    saveDatabase(db);
  },
  
  // Chat messages
  getChatMessages: (sessionId: string) => {
    return db.chatMessages.filter(
      (m: Record<string, unknown>) => m.sessionId === sessionId
    );
  },
  
  addChatMessage: (message: Record<string, unknown>) => {
    db.chatMessages.push(message);
    saveDatabase(db);
  },
  
  // Runtime connections
  getRuntimeConnection: (type: string) => {
    return db.runtimeConnections[type];
  },
  
  setRuntimeConnection: (type: string, connection: unknown) => {
    db.runtimeConnections[type] = connection;
    saveDatabase(db);
  },
  
  // Usage log
  addUsageLog: (entry: unknown) => {
    db.usageLog.push(entry);
    saveDatabase(db);
  },
  
  getUsageLog: () => db.usageLog,

  // Generic orchestration collections
  getCollection: <T = Record<string, unknown>>(name: CollectionName): T[] => {
    return db[name] as T[];
  },

  setCollection: (name: CollectionName, items: Record<string, unknown>[]): void => {
    (db[name] as Record<string, unknown>[]) = items;
    saveDatabase(db);
  },

  addToCollection: <T extends { id: string }>(name: CollectionName, item: T): T => {
    (db[name] as Record<string, unknown>[]).push(item as unknown as Record<string, unknown>);
    saveDatabase(db);
    return item;
  },

  updateInCollection: <T extends { id: string }>(
    name: CollectionName,
    id: string,
    updates: Partial<T>
  ): T | undefined => {
    const collection = db[name] as Record<string, unknown>[];
    const index = collection.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    const updated = { ...collection[index], ...updates, id } as unknown as T;
    collection[index] = updated;
    saveDatabase(db);
    return updated;
  },

  deleteFromCollection: (name: CollectionName, id: string): boolean => {
    const collection = db[name] as Record<string, unknown>[];
    const before = collection.length;
    const filtered = collection.filter((item) => item.id !== id);
    db[name] = filtered as never;
    const changed = filtered.length !== before;
    if (changed) saveDatabase(db);
    return changed;
  },
};

export { CONFIG_DIR };
