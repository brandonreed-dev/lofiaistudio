import type { CloudProvider, Modality, TextGenerationParams, ChatMessage } from '@lofiaistudio/shared';
import type { CloudAdapter } from './index.js';

export class AnthropicAdapter implements CloudAdapter {
  readonly provider: CloudProvider = 'anthropic';
  readonly name = 'Anthropic';
  readonly supportedModalities: Modality[] = ['text'];
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';
  private apiVersion = '2023-06-01';

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    if (baseUrl) this.baseUrl = baseUrl;
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
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
    // Extract system prompt if present
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: params.maxTokens ?? 2048,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      temperature: params.temperature ?? 0.7,
      top_p: params.topP ?? 0.9,
      top_k: params.topK ?? 40,
      stop_sequences: params.stop,
      stream: onToken ? true : false,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (onToken) {
      return this.streamChat(body, onToken);
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? '';
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
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
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
            const content = parsed.delta?.text ?? parsed.content_block?.text ?? '';
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