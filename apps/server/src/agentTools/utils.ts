import type { Skill } from '@lofiaistudio/shared';

export function normalizeQuery(value: unknown): string {
  return String(value ?? '').trim();
}

export function findSkillByIdOrName(allSkills: Skill[], query: string): Skill | undefined {
  const normalized = normalizeQuery(query);
  if (!normalized) return undefined;
  return allSkills.find(
    (s) => s.id === normalized || s.name.toLowerCase() === normalized.toLowerCase()
  );
}

export function extractQuotedName(text: string): string | null {
  const match = text.match(/[""''`]([^""''`]+)[""''`]/);
  return match ? match[1].trim() : null;
}

export function chunkTextForStream(text: string, size = 12): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
