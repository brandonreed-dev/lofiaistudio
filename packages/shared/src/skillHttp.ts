/**
 * Merge parameters for HTTP skills: defaults < node input < workflow input.
 * Used to fill `{placeholder}` segments in endpoint URL templates.
 */
export function mergeHttpSkillParams(
  defaults: Record<string, unknown> | undefined,
  nodeInput: Record<string, unknown> | undefined,
  workflowInput: Record<string, unknown> | undefined
): Record<string, unknown> {
  return {
    ...(defaults ?? {}),
    ...(nodeInput ?? {}),
    ...(workflowInput ?? {}),
  };
}

/**
 * Replace `{param}` in `endpoint` with encodeURIComponent(String(params[param]))`.
 * Returns an error if any placeholder is missing or still unresolved.
 */
export function applyHttpEndpointTemplate(
  endpoint: string,
  params: Record<string, unknown>
): { url: string; error?: string } {
  const unresolved = new Set<string>();
  const url = endpoint.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const v = params[key];
    if (v === undefined || v === null) {
      unresolved.add(key);
      return `{${key}}`;
    }
    return encodeURIComponent(String(v));
  });
  if (unresolved.size > 0) {
    return { url, error: `Missing template parameters: ${[...unresolved].join(', ')}` };
  }
  if (/\{[a-zA-Z0-9_]+\}/.test(url)) {
    return { url, error: 'Unresolved placeholders in URL' };
  }
  return { url };
}
