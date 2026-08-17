import type { Project, ProjectNode, ProjectEdge } from '@lofiaistudio/shared';

/**
 * Self-referential "LoFi AI Studio" project.
 * Models LoFi AI Studio's own architecture for reference and dogfooding.
 */
export const LOFIAISTUDIO_PROJECT_ID = 'project-lofiaistudio';

const nodes: ProjectNode[] = [
  // ── Environments ──
  {
    id: 'ls-env-dev',
    type: 'environment.dev',
    label: 'Development Environment',
    x: 40,
    y: 40,
    config: {
      description: 'Local development environment where all services run on localhost.',
    },
  },
  {
    id: 'ls-env-prod',
    type: 'environment.prod',
    label: 'Production Environment',
    x: 40,
    y: 520,
    config: {
      description: 'Production/staging deployment environment for end users.',
    },
  },
  // ── Frontend ──
  {
    id: 'ls-fe',
    type: 'service',
    label: 'Web Frontend (React / Vite)',
    x: 340,
    y: 40,
    config: {
      port: 5173,
      protocol: 'http',
      healthCheckUrl: '/',
      description: 'React SPA with Vite dev server. Runs on localhost:5173 during development.',
    },
  },
  // ── Server ──
  {
    id: 'ls-srv',
    type: 'service',
    label: 'API Server (Express)',
    x: 340,
    y: 220,
    config: {
      port: 3001,
      protocol: 'http',
      healthCheckUrl: '/api/runtimes',
      description: 'Express.js backend that serves the API, orchestrates runtimes, and manages workflows.',
    },
  },
  // ── Shared Package ──
  {
    id: 'ls-shared',
    type: 'repo',
    label: 'Shared Types Package',
    x: 620,
    y: 40,
    config: {
      branch: 'main',
      autoSync: true,
      description: 'packages/shared — TypeScript types shared between frontend and server.',
    },
  },
  // ── Database ──
  {
    id: 'ls-db',
    type: 'database',
    label: 'JSON File Database',
    x: 620,
    y: 220,
    config: {
      dbType: 'sqlite',
      description: 'Persistent JSON file at ~/.lofiaistudio/lofiaistudio.json. Stores agents, workflows, projects, etc.',
    },
  },
  // ── Secrets ──
  {
    id: 'ls-secrets',
    type: 'secrets',
    label: 'Secrets / .env',
    x: 620,
    y: 400,
    config: {
      provider: 'env',
      keys: ['OLLAMA_HOST', 'COMFYUI_HOST', 'QWEN3_AUDIO_HOST', 'A1111_HOST'],
      description: 'Environment variables configured in .env or the Settings panel.',
    },
  },
  // ── GitHub Repo ──
  {
    id: 'ls-repo',
    type: 'repo',
    label: 'Git Repository',
    x: 620,
    y: 580,
    config: {
      autoSync: true,
      description: 'The LoFi AI Studio source code repository on GitHub.',
    },
  },
  // ── Runtimes ──
  {
    id: 'ls-ollama',
    type: 'service',
    label: 'Ollama (LLM Runtime)',
    x: 340,
    y: 400,
    config: {
      port: 11434,
      protocol: 'http',
      healthCheckUrl: '/api/tags',
      description: 'Local LLM server providing text generation models like Gemma, Llama, etc.',
    },
  },
  {
    id: 'ls-comfy',
    type: 'service',
    label: 'ComfyUI (Image Runtime)',
    x: 340,
    y: 560,
    config: {
      port: 8188,
      protocol: 'http',
      description: 'Stable Diffusion workflow engine for image and video generation.',
    },
  },
  {
    id: 'ls-qwen3',
    type: 'service',
    label: 'Qwen3 Audio Wrapper',
    x: 340,
    y: 720,
    config: {
      port: 8001,
      protocol: 'http',
      description: 'Lightweight ASR / TTS wrapper around Qwen3-Audio for speech-to-text and text-to-speech.',
    },
  },
  // ── Endpoint ──
  {
    id: 'ls-endpoint',
    type: 'endpoint',
    label: 'REST API Endpoints',
    x: 900,
    y: 220,
    config: {
      path: '/api/*',
      method: 'GET',
      auth: 'none',
      rateLimit: 0,
      description: 'All API routes served by Express under /api/ (agents, workflows, models, activity, etc.).',
    },
  },
  // ── Deployment ──
  {
    id: 'ls-deploy',
    type: 'deployment',
    label: 'Manual / CI Deployment',
    x: 900,
    y: 520,
    config: {
      strategy: 'rolling',
      autoDeploy: false,
      description: 'Manual deployment or future GitHub Actions CI pipeline for production releases.',
    },
  },
];

const edges: ProjectEdge[] = [
  // Frontend ↔ Server
  { id: 'ls-e-fe-srv', from: 'ls-fe', to: 'ls-srv' },
  // Frontend ↔ Shared
  { id: 'ls-e-fe-shared', from: 'ls-fe', to: 'ls-shared' },
  // Server ↔ Shared
  { id: 'ls-e-srv-shared', from: 'ls-srv', to: 'ls-shared' },
  // Server ↔ Database
  { id: 'ls-e-srv-db', from: 'ls-srv', to: 'ls-db' },
  // Server ↔ Secrets
  { id: 'ls-e-srv-secrets', from: 'ls-srv', to: 'ls-secrets' },
  // Server ↔ Runtimes
  { id: 'ls-e-srv-ollama', from: 'ls-srv', to: 'ls-ollama' },
  { id: 'ls-e-srv-comfy', from: 'ls-srv', to: 'ls-comfy' },
  { id: 'ls-e-srv-qwen3', from: 'ls-srv', to: 'ls-qwen3' },
  // Endpoint → Server
  { id: 'ls-e-ep-srv', from: 'ls-endpoint', to: 'ls-srv' },
  // Repo → Shared
  { id: 'ls-e-repo-shared', from: 'ls-repo', to: 'ls-shared' },
  // Deployment → Prod
  { id: 'ls-e-deploy-prod', from: 'ls-deploy', to: 'ls-env-prod' },
];

export function createLoFiAIStudioProject(createdAt: string): Project {
  return {
    id: LOFIAISTUDIO_PROJECT_ID,
    name: 'LoFi AI Studio',
    description:
      'Self-referential reference project that models Lofi AI Studio\'s own architecture. Use this as a starting point to understand how the application works and how to structure your own projects.',
    status: 'active',
    environment: 'local',
    members: [],
    retentionDays: 90,
    nodes,
    edges,
    createdAt,
    updatedAt: createdAt,
  };
}