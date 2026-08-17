import { render } from '@testing-library/react';

/**
 * Wait for a condition to become true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Render component with test wrapper
 */
export function renderWithProviders(ui: React.ReactElement) {
  return render(ui);
}

/**
 * Mock useOrchestrationStore hook
 */
export function createMockOrchestrationStore(overrides = {}) {
  return {
    activity: [],
    projects: [],
    agents: [],
    workflows: [],
    skills: [],
    tasks: [],
    integrations: [],
    users: [],
    isLoading: false,
    error: null,
    loadAll: () => Promise.resolve(),
    connectRuntimes: () => Promise.resolve(),
    openDrawer: () => {},
    pushToast: () => {},
    updateEntity: () => Promise.resolve(),
    deleteEntity: () => Promise.resolve(),
    createEntity: () => Promise.resolve(),
    ...overrides,
  };
}