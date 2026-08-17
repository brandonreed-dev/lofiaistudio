/**
 * Smoke tests - critical user flows that must pass
 * Run with: npm run test:smoke
 */

import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { waitFor } from '../utils';

let devServer: ReturnType<typeof spawn>;

test.beforeAll(async () => {
  // Start dev server
  devServer = spawn('npm', ['run', 'dev'], { shell: true });
  
  // Wait for server to be ready
  await waitFor(() => {
    // Adjust port/message as needed for your dev server
    return true; // Placeholder
  }, 30000);
});

test.afterAll(async () => {
  if (devServer) {
    devServer.kill();
  }
});

test.describe('Critical User Flows', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await expect(page.locator('text=LoFi AI Studio')).toBeVisible();
  });

  test('can navigate to text panel', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.click('[data-view="text"]');
    await expect(page.locator('text=Text')).toBeVisible();
  });

  test('chat input exists on text panel', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.click('[data-view="text"]');
    await expect(page.locator('textarea')).toBeVisible();
  });
});