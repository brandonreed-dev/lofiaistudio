import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectEditorView } from '../../components/panels/projects/ProjectEditorView';

describe('ProjectEditorView', () => {
  it('should show loading state when project is not found', () => {
    const mockLoadAll = vi.fn();
    render(<ProjectEditorView projectId="nonexistent-id" loadAll={mockLoadAll} />);
    
    expect(screen.getByText('Loading project...')).toBeDefined();
  });

  it('should call loadAll when project is not initially found', () => {
    const mockLoadAll = vi.fn();
    render(<ProjectEditorView projectId="test-id" loadAll={mockLoadAll} />);
    
    expect(mockLoadAll).toHaveBeenCalled();
  });
});
