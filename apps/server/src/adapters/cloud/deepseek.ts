import type { CloudProvider, Modality, TextGenerationParams, ChatMessage } from '@lofiaistudio/shared';
import type { CloudAdapter } from './index.js';

export class DeepseekAdapter implements CloudAdapter {
  readonly provider: CloudProvider = 'deepseek';
  readonly name = 'Deepseek';
  readonly supportedModalities: Modality[] = ['text'];
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    if (baseUrl) this.baseUrl = baseUrl;
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(
    modelId: string,
    messages: ChatMessage[],
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: params.temperature ?? 0.7,
      top_p: params.topP ?? 0.9,
      max_tokens: params.maxTokens ?? 2048,
      stop: params.stop,
      stream: onToken ? true : false,
    };

    if (params.seed !== undefined) body.seed = params.seed;

    if (onToken) {
      return this.streamChat(body, onToken);
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepseek API error (${response.status}): ${error}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  async complete(
    modelId: string,
    prompt: string,
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string> {
    return this.chat(
      modelId,
      [{ id: 'user', role: 'user', content: prompt, timestamp: new Date() }],
      params,
      onToken
    );
  }

  private async streamChat(
    body: Record<string, unknown>,
    onToken: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepseek API error (${response.status}): ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return fullContent;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content ?? '';
            if (content) {
              fullContent += content;
              onToken(content);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullContent;
  }
}