import { describe, expect, it } from 'vitest';
import { detectFormat, extractComfyClassTypes, workflowCategory } from './importExport';

describe('workflow import helpers', () => {
  it('detects ComfyUI, n8n, and generic workflow JSON', () => {
    expect(detectFormat({ '1': { class_type: 'KSampler', inputs: {} } })).toBe('comfyui');
    expect(detectFormat({ nodes: [], connections: {} })).toBe('n8n');
    expect(detectFormat({ name: 'Native' })).toBe('generic');
  });

  it('extracts unique ComfyUI class types and normalizes categories', () => {
    expect(extractComfyClassTypes({ a: { class_type: 'KSampler' }, b: { class_type: 'KSampler' }, c: {} })).toEqual(['KSampler']);
    expect(workflowCategory({ category: '  Image  ' })).toBe('Image');
    expect(workflowCategory({})).toBe('General');
  });
});
