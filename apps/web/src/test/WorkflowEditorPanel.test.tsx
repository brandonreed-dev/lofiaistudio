import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkflowEditorPanel } from '../../components/panels/workflows/WorkflowsPanel';

describe('WorkflowEditorPanel', () => {
  it('should use refs for latest values in handleRun', () => {
    const mockWorkflow = {
      id: 'test-wf',
      name: 'Test Workflow',
      nodes: [],
      edges: [],
    };
    const mockNodes = [];
    const mockEdges = [];
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    const mockOnRun = vi.fn();
    
    render(
      <WorkflowEditorPanel
        workflow={mockWorkflow}
        workflows={[]}
        onRun={mockOnRun}
        onSelect={vi.fn()}
        onExport={vi.fn()}
        onSave={mockOnSave}
        saving={false}
      />
    );
    
    // Find and click the run button (Play icon)
    const runButton = screen.getByTitle('Run workflow');
    runButton.click();
    
    // onSave should be called with the latest refs
    expect(mockOnSave).toHaveBeenCalledWith(mockWorkflow, mockNodes, mockEdges);
    expect(mockOnRun).toHaveBeenCalled();
  });
});