export const MAX_TOOL_ROUNDS = 8;

export const TOOL_SYSTEM_HINT =
  'When the user wants live or current data (e.g. Reddit posts, searches) or wants to run a workflow, you must call the provided tools with concrete arguments. Do not invent JSON or search resultsâ€”use tools.';

export const MGMT_SKILL_READ = '_mgmt_skill_read';
export const MGMT_SKILL_CREATE = '_mgmt_skill_create';
export const MGMT_SKILL_UPDATE = '_mgmt_skill_update';
export const MGMT_SKILL_DELETE = '_mgmt_skill_delete';

export const MGMT_PROJECT_READ = '_mgmt_project_read';
export const MGMT_PROJECT_READ_NODES = '_mgmt_project_read_nodes';
export const MGMT_PROJECT_ADD_NODE = '_mgmt_project_add_node';
export const MGMT_PROJECT_UPDATE_NODE = '_mgmt_project_update_node';
export const MGMT_PROJECT_CONNECT_NODES = '_mgmt_project_connect_nodes';

export const MGMT_MUTATION_TOOL_IDS = new Set([
  MGMT_SKILL_CREATE,
  MGMT_SKILL_UPDATE,
  MGMT_SKILL_DELETE,
  MGMT_PROJECT_ADD_NODE,
  MGMT_PROJECT_UPDATE_NODE,
  MGMT_PROJECT_CONNECT_NODES,
]);
