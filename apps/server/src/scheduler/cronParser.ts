/**
 * Parse a cron expression and compute the next run time.
 * Supports standard 5-field cron expressions and simple intervals (e.g., every N minutes).
 */
export function computeNextRunAt(cron: string, from = new Date()): string {
  const parts = cron.trim().split(/\s+/);
  const fallback = new Date(from.getTime() + 30 * 60 * 1000);
  if (parts.length !== 5) return fallback.toISOString();

  const [minute, hour] = parts;
  if (minute.startsWith('*/')) {
    const interval = Math.max(1, Number(minute.slice(2)) || 30);
    return new Date(from.getTime() + interval * 60 * 1000).toISOString();
  }

  const minuteNumber = Number(minute);
  const hourNumber = Number(hour);
  if (Number.isInteger(minuteNumber) && Number.isInteger(hourNumber)) {
    const next = new Date(from);
    next.setHours(hourNumber, minuteNumber, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  return fallback.toISOString();
}