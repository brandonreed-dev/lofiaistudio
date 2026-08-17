import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrchestrationPanel } from '../../components/panels/OrchestrationPanel';

describe('OrchestrationPanel', () => {
  it('should show loading state when loading with no data', () => {
    const mockUseOrchestrationStore = {
      activity: [],
      projects: [],
      agents: [],
      workflows: [],
      skills: [],
      tasks: [],
      integrations: [],
      users: [],
      isLoading: true,
      error: null,
      loadAll: vi.fn(),
      connectRuntimes: vi.fn(),
    };

    vi.doMock('@/stores/orchestration', () => ({
      useOrchestrationStore: () => mockUseOrchestrationStore,
    }));

    render(<OrchestrationPanel view="dashboard" />);
    
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('should show error state when error exists', () => {
    const mockUseOrchestrationStore = {
      activity: [],
      projects: [],
      agents: [],
      workflows: [],
      skills: [],
      tasks: [],
      integrations: [],
      users: [],
      isLoading: false,
      error: 'Failed to load data',
      loadAll: vi.fn(),
      connectRuntimes: vi.fn(),
      openDrawer: vi.fn(),
      fetchModels: vi.fn(),
      react: { useState: vi.fn(() => [{}, vi.fn()]) },
    };

    vi.doMock('@/stores/orchestration', () => ({
      useOrchestrationStore: () => mockUseOrchestrationStore,
    }));

    render(<OrchestrationPanel view="dashboard" />);
    
    expect(screen.getByText('Error loading data')).toBeDefined();
    expect(screen.getByText('Failed to load data')).toBeDefined();
  });
});