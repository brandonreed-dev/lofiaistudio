import { describe, it, expect } from 'vitest';
import { NAV, VIEW_LABELS, breadcrumbGroupFor } from './navigation';
import { VIEW_LABELS as AppViewLabels, View } from '@/stores';

describe('Navigation integrity', () => {
  it('every NAV view has a label', () => {
    const allViews = NAV.flatMap((g) => g.items.map((i) => i.view));
    const uniqueViews = new Set(allViews);
    for (const view of uniqueViews) {
      expect(AppViewLabels[view]).toBeDefined();
      expect(typeof AppViewLabels[view]).toBe('string');
      expect(AppViewLabels[view].length).toBeGreaterThan(0);
    }
  });

  it('every NAV view exists in the View type', () => {
    const appViews = new Set<string>(
      Object.keys(AppViewLabels) as string[]
    );
    for (const view of NAV.flatMap((g) => g.items.map((i) => i.view))) {
      expect(appViews.has(view)).toBe(true);
    }
  });

  it('NAV has no duplicate view across groups', () => {
    const allViews = NAV.flatMap((g) => g.items.map((i) => i.view));
    const seen = new Set<string>();
    for (const view of allViews) {
      expect(seen.has(view)).toBe(false);
      seen.add(view);
    }
  });

  it('breadcrumbGroupFor returns the group title for each view', () => {
    for (const group of NAV) {
      for (const item of group.items) {
        expect(breadcrumbGroupFor(item.view)).toBe(group.title);
      }
    }
  });

  it('NAV sections have unique titles', () => {
    const titles = NAV.map((g) => g.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
