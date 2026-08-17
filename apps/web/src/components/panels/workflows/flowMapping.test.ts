import { describe, expect, it } from 'vitest';
import { flowToWorkflow, workflowToFlow } from './flowMapping';
import type { Workflow } from '@lofiaistudio/shared';

describe('workflow flow mapping', () => {
  it('round-trips native workflow nodes and edges', () => {
    const workflow: Workflow = {
      id: 'wf',
      name: 'Test',
      description: '',
      project: 'General',
      category: 'General',
      enabled: true,
      createdAt: 'now',
      updatedAt: 'now',
      nodes: [{ id: 'n1', type: 'trigger.manual', label: 'Manual', x: 1.2, y: 2.8, config: { ok: true } }],
      edges: [{ id: 'e1', from: 'n1', to: 'n1' }],
    };

    const flow = workflowToFlow(workflow);
    expect(flow.nodes[0].data.nodeType).toBe('trigger.manual');
    expect(flow.edges[0].source).toBe('n1');

    expect(flowToWorkflow(workflow, flow.nodes, flow.edges)).toMatchObject({
      nodes: [{ id: 'n1', x: 1, y: 3, config: { ok: true } }],
      edges: [{ id: 'e1', from: 'n1', to: 'n1' }],
    });
  });
});
