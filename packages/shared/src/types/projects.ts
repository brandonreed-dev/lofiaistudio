// ============================================
// Project Types
// ============================================

export type ProjectNodeType =
  | 'environment.dev'
  | 'environment.staging'
  | 'environment.prod'
  | 'container.data'
  | 'container.compute'
  | 'repo'
  | 'database'
  | 'vector.store'
  | 'service'
  | 'workflow.ref'
  | 'agent.ref'
  | 'deployment'
  | 'endpoint'
  | 'secrets';

export interface ProjectNode {
  id: string;
  type: ProjectNodeType;
  label: string;
  x: number;
  y: number;
  parentId?: string;
  config: Record<string, unknown>;
}

export interface ProjectEdge {
  id: string;
  from: string;
  to: string;
}

export interface EnvironmentConfig {
  url?: string;
  description?: string;
  variables?: Record<string, string>;
  resourceLimits?: { cpu?: string; memory?: string; storage?: string };
}

export interface ContainerConfig {
  image?: string;
  volumeMount?: string;
  storageSize?: string;
  connectionString?: string;
  cpuLimit?: string;
  memoryLimit?: string;
  environmentVariables?: Record<string, string>;
  scaling?: { min?: number; max?: number; target?: number };
}

export interface RepoConfig {
  gitUrl?: string;
  branch?: string;
  authToken?: string;
  autoSync?: boolean;
}

export interface DatabaseConfig {
  dbType?: 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'redis';
  connectionString?: string;
  backupSchedule?: string;
}

export interface VectorStoreConfig {
  storeType?: 'chroma' | 'pinecone' | 'weaviate' | 'milvus';
  dimension?: number;
  connectionString?: string;
}

export interface ServiceConfig {
  port?: number;
  protocol?: 'http' | 'https' | 'grpc' | 'tcp';
  healthCheckUrl?: string;
}

export interface WorkflowRefConfig {
  workflowId?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
}

export interface AgentRefConfig {
  agentId?: string;
  role?: string;
}

export interface DeploymentConfig {
  targetEnvironment?: 'environment.dev' | 'environment.staging' | 'environment.prod';
  strategy?: 'rolling' | 'blue-green' | 'canary';
  autoDeploy?: boolean;
}

export interface EndpointConfig {
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  rateLimit?: number;
  auth?: 'none' | 'api-key' | 'jwt';
}

export interface SecretsConfig {
  provider?: 'env' | 'vault' | 'aws-secrets' | 'gcp-secret-manager';
  keys?: string[];
}

export interface ProjectMember {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'archived';
  environment: 'local' | 'staging' | 'production';
  members: ProjectMember[];
  retentionDays: number;
  defaultWorkspaceId?: string;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  versionNumber?: number;
  message?: string;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  createdAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
}