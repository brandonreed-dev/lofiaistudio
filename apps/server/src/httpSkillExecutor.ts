import type { Skill } from '@lofiaistudio/shared';
// runtime helpers from shared are imported dynamically inside the function to avoid top-level module resolution during tests

const EXTERNAL_HTTP_USER_AGENT = 'LoFiAIStudio/1.0 (+https://github.com/lofiaistudio)';

/** Prefix relative paths so Node fetch works (e.g. legacy skills with /api/...). */
export function resolveSkillFetchUrl(maybeRelative: string): string {
  const t = maybeRelative.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('/')) {
    const origin = process.env.LOFIAI_API_SELF_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`;
    return `${origin.replace(/\/$/, '')}${t}`;
  }
  return t;
}

/**
 * Perform one HTTP skill request: merge inputs, expand `{placeholder}` in endpoint if present, fetch.
 */
export async function executeHttpSkillRequest(
  skill: Skill,
  panelOrNodeInput: Record<string, unknown> | undefined,
  workflowInput: Record<string, unknown> | undefined
): Promise<{ status: number; result: unknown }> {
  const { mergeHttpSkillParams, applyHttpEndpointTemplate } = await import('@lofiaistudio/shared');
  const merged = mergeHttpSkillParams(skill.runInputDefaults, panelOrNodeInput, workflowInput);
  const rawEndpoint = skill.endpoint?.trim() ?? '';
  if (!rawEndpoint) {
    throw new Error('Skill has no endpoint');
  }

  const hasTemplate = /\{[a-zA-Z0-9_]+\}/.test(rawEndpoint);
  let url = rawEndpoint;
  if (hasTemplate) {
    const applied = applyHttpEndpointTemplate(rawEndpoint, merged);
    if (applied.error) {
      throw new Error(applied.error);
    }
    url = applied.url;
  }
  url = resolveSkillFetchUrl(url);

  const method = skill.method ?? 'POST';
  const isGet = method === 'GET';
  const headers: Record<string, string> = {};
  if (!isGet) {
    headers['Content-Type'] = 'application/json';
  }
  if (/reddit\.com/i.test(url)) {
    headers['User-Agent'] = EXTERNAL_HTTP_USER_AGENT;
  }

  const init: RequestInit = { method, headers };
  if (!isGet) {
    init.body = JSON.stringify(merged);
  }

  const res = await fetch(url, init);
  const body = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = body;
  }
  return { status: res.status, result: json };
}
