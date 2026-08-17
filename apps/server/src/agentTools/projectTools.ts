import type { Agent, Project, ProjectNode, ProjectNodeType, ProjectEdge } from '@lofiaistudio/shared';
import { v4 as uuidv4 } from 'uuid';
import { dbOperations } from '../db/index.js';
import { LOFIAISTUDIO_PROJECT_ID } from '../seed/lofiaistudio-project.js';
import {
  MGMT_PROJECT_READ,
  MGMT_PROJECT_READ_NODES,
  MGMT_PROJECT_ADD_NODE,
  MGMT_PROJECT_UPDATE_NODE,
  MGMT_PROJECT_CONNECT_NODES,
} from './constants.js';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Build management tools for project inspection and modification.
 * These are injected alongside skill/workflow tools when the agent
 * is assigned to the LoFi AI Studio project.
 */
export function buildProjectTools(agent: Agent): {
  tools: unknown[];
  handlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
} {
  const tools: unknown[] = [];
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  const lsProjectId = LOFIAISTUDIO_PROJECT_ID;

  if (agent.capabilities.projectRead) {
    // Read project summary
    tools.push({
      type: 'function',
      function: {
        name: MGMT_PROJECT_READ,
        description:
          'Read the LoFi AI Studio project summary. Returns project name, description, status, environment, node/edge counts, and associated workflows and agents. No arguments needed.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    });
    handlers.set(MGMT_PROJECT_READ, async () => {
      const projects = dbOperations.getCollection<Project>('projects');
      const project = projects.find((p) => p.id === lsProjectId);
      if (!project) return { error: 'LoFi AI Studio project not found.' };
      const workflows = dbOperations.getCollection('workflows').filter(
        (w: Record<string, unknown>) => w.project === lsProjectId
      );
      const agents = dbOperations.getCollection('agents').filter(
        (a: Record<string, unknown>) => a.project === lsProjectId
      );
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        environment: project.environment,
        nodeCount: (project.nodes ?? []).length,
        edgeCount: (project.edges ?? []).length,
        associatedWorkflows: workflows.length,
        associatedAgents: agents.length,
      };
    });

    // Read project nodes
    tools.push({
      type: 'function',
      function: {
        name: MGMT_PROJECT_READ_NODES,
        description:
          'Read the list of nodes and edges in the LoFi AI Studio project. Returns all node types, labels, positions, config keys, and edge connections. Use this to inspect the current architecture diagram.',
        parameters: {
          type: 'object',
          properties: {
            filterType: {
              type: 'string',
              description: 'Optional: filter nodes by type prefix (e.g. "service", "repo", "environment", "database"). If omitted, returns all nodes.',
            },
          },
        },
      },
    });
    handlers.set(MGMT_PROJECT_READ_NODES, async (args) => {
      const projects = dbOperations.getCollection<Project>('projects');
      const project = projects.find((p) => p.id === lsProjectId);
      if (!project) return { error: 'LoFi AI Studio project not found.' };

      let nodes = project.nodes ?? [];
      const edges = project.edges ?? [];

      if (args.filterType && typeof args.filterType === 'string') {
        const filter = String(args.filterType).toLowerCase();
        nodes = nodes.filter((n) => n.type.toLowerCase().startsWith(filter));
      }

      return {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          position: { x: n.x, y: n.y },
          configKeys: Object.keys(n.config ?? {}),
        })),
        edges: edges.map((e) => ({
          id: e.id,
          from: e.from,
          to: e.to,
        })),
      };
    });
  }

  if (agent.capabilities.projectWrite) {
    // Add node
    tools.push({
      type: 'function',
      function: {
        name: MGMT_PROJECT_ADD_NODE,
        description:
          'Add a new node to the LoFi AI Studio project graph. Provide a type, label, and optional config. Valid types include: environment.dev, environment.staging, environment.prod, container.data, container.compute, repo, database, vector.store, service, workflow.ref, agent.ref, deployment, endpoint, secrets. Position is optional (auto-placed if omitted).',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Node type (e.g. "service", "repo", "database", "endpoint", "secrets", "environment.dev")',
            },
            label: {
              type: 'string',
              description: 'Display label for the node (e.g. "My API Service")',
            },
            x: {
              type: 'number',
              description: 'Optional X position (auto-placed if omitted)',
            },
            y: {
              type: 'number',
              description: 'Optional Y position (auto-placed if omitted)',
            },
            config: {
              type: 'object',
              description: 'Optional node configuration as a JSON object',
            },
          },
          required: ['type', 'label'],
        },
      },
    });
    handlers.set(MGMT_PROJECT_ADD_NODE, async (args) => {
      const projects = dbOperations.getCollection<Project>('projects');
      const projectIdx = projects.findIndex((p) => p.id === lsProjectId);
      if (projectIdx === -1) return { error: 'LoFi AI Studio project not found.' };

      const nodeType = String(args.type ?? 'service');
      const label = String(args.label ?? 'New Node');
      const config = (args.config as Record<string, unknown>) ?? {};

      // Auto-place: offset from last node or default
      const existingNodes = projects[projectIdx].nodes ?? [];
      let x = 100;
      let y = 100;
      if (args.x !== undefined) {
        x = Number(args.x);
        y = Number(args.y ?? 100);
      } else if (existingNodes.length > 0) {
        const last = existingNodes[existingNodes.length - 1];
        x = last.x + 220;
        y = last.y;
        if (x > 900) { x = 60; y = last.y + 120; }
      }

      const newNode: ProjectNode = {
        id: `node-${generateId()}`,
        type: nodeType as ProjectNodeType,
        label,
        x,
        y,
        config,
      };

      const updated = { ...projects[projectIdx], nodes: [...existingNodes, newNode], updatedAt: new Date().toISOString() };
      dbOperations.updateInCollection('projects', lsProjectId, { nodes: updated.nodes, updatedAt: updated.updatedAt } as Partial<Project>);
      return { success: true, node: { id: newNode.id, type: newNode.type, label: newNode.label } };
    });

    // Update node
    tools.push({
      type: 'function',
      function: {
        name: MGMT_PROJECT_UPDATE_NODE,
        description:
          'Update an existing node in the LoFi AI Studio project graph. Provide the node ID (from _mgmt_project_read_nodes) and the fields to update: label, x, y, and/or config.',
        parameters: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'Node ID to update' },
            label: { type: 'string', description: 'New label for the node' },
            x: { type: 'number', description: 'New X position' },
            y: { type: 'number', description: 'New Y position' },
            config: { type: 'object', description: 'New config object (replaces existing config entirely)' },
          },
          required: ['nodeId'],
        },
      },
    });
    handlers.set(MGMT_PROJECT_UPDATE_NODE, async (args) => {
      const projects = dbOperations.getCollection<Project>('projects');
      const projectIdx = projects.findIndex((p) => p.id === lsProjectId);
      if (projectIdx === -1) return { error: 'LoFi AI Studio project not found.' };

      const nodeId = String(args.nodeId ?? '');
      const existingNodes = projects[projectIdx].nodes ?? [];
      const nodeIdx = existingNodes.findIndex((n) => n.id === nodeId);
      if (nodeIdx === -1) return { error: `Node "${nodeId}" not found.` };

      const node = existingNodes[nodeIdx];
      const updatedNode: ProjectNode = {
        ...node,
        label: args.label !== undefined ? String(args.label) : node.label,
        x: args.x !== undefined ? Number(args.x) : node.x,
        y: args.y !== undefined ? Number(args.y) : node.y,
        config: args.config !== undefined ? (args.config as Record<string, unknown>) : node.config,
      };

      const newNodes = [...existingNodes];
      newNodes[nodeIdx] = updatedNode;
      dbOperations.updateInCollection('projects', lsProjectId, { nodes: newNodes, updatedAt: new Date().toISOString() } as Partial<Project>);
      return { success: true, node: { id: updatedNode.id, label: updatedNode.label } };
    });

    // Connect nodes
    tools.push({
      type: 'function',
      function: {
        name: MGMT_PROJECT_CONNECT_NODES,
        description:
          'Create or remove a connection (edge) between two nodes in the LoFi AI Studio project graph. Provide the from and to node IDs (from _mgmt_project_read_nodes). Set delete to true to remove an existing edge.',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source node ID' },
            to: { type: 'string', description: 'Target node ID' },
            delete: { type: 'boolean', description: 'If true, remove the edge instead of adding it' },
          },
          required: ['from', 'to'],
        },
      },
    });
    handlers.set(MGMT_PROJECT_CONNECT_NODES, async (args) => {
      const projects = dbOperations.getCollection<Project>('projects');
      const projectIdx = projects.findIndex((p) => p.id === lsProjectId);
      if (projectIdx === -1) return { error: 'LoFi AI Studio project not found.' };

      const from = String(args.from ?? '');
      const to = String(args.to ?? '');
      const existingEdges = projects[projectIdx].edges ?? [];

      if (args.delete === true) {
        const filtered = existingEdges.filter((e) => !(e.from === from && e.to === to));
        dbOperations.updateInCollection('projects', lsProjectId, { edges: filtered, updatedAt: new Date().toISOString() } as Partial<Project>);
        return { success: true, action: 'removed', from, to };
      }

      // Check for duplicate
      if (existingEdges.some((e) => e.from === from && e.to === to)) {
        return { error: 'Connection already exists between these nodes.', from, to };
      }

      const newEdge: ProjectEdge = {
        id: `edge-${generateId()}`,
        from,
        to,
      };

      dbOperations.updateInCollection('projects', lsProjectId, {
        edges: [...existingEdges, newEdge],
        updatedAt: new Date().toISOString(),
      } as Partial<Project>);
      return { success: true, action: 'added', edge: { id: newEdge.id, from: newEdge.from, to: newEdge.to } };
    });
  }

  return { tools, handlers };
}

/**
 * Safe wrapper for buildProjectTools — returns empty arrays if
 * agent or capabilities is undefined.
 */
export function safeBuildProjectTools(agent: Agent | undefined): {
  tools: unknown[];
  handlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
} {
  if (!agent || !agent.capabilities) {
    return { tools: [], handlers: new Map() };
  }
  return buildProjectTools(agent);
}