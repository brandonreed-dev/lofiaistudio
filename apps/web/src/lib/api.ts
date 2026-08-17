import type { ApiResponse } from '@lofiaistudio/shared';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new ApiError(payload.error ?? `Request failed with ${response.status}`, response.status, payload);
  }
  return payload.data as T;
}
