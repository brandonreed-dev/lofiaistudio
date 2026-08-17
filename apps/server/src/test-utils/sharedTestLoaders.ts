export function makeFakeTextAdapter() {
  return {
    type: 'ollama',
    endpoint: 'http://localhost',
    isConnected: () => true,
    getSupportedModalities: () => ['text', 'image'],
    getModels: async () => [
      { id: 'fake-text-model', modality: 'text', runtime: 'local' },
      { id: 'fake-image-model', modality: 'image', runtime: 'local' },
    ],
    complete: async (id: string, prompt: string) => `completed: ${prompt}`,
    chat: async (id: string, messages: any[]) => `chat: ${messages.map((m) => m.content).join(';')}`,
    connect: async () => true,
    getStatus: async () => ({ type: 'ollama', connected: true, endpoint: 'http://localhost', models: [] }),
  } as any;
}

export function makeFakeAdapterRegistry(adapter: any) {
  return {
    get: (t: string) => adapter,
    getAll: () => [adapter],
    findModel: async (modelId: string) => ({ adapter, model: { id: modelId, modality: modelId.includes('image') ? 'image' : 'text', runtime: 'local' } }),
    connectAll: async () => [{ type: adapter.type, connected: true, endpoint: adapter.endpoint, models: [] }],
    getStatuses: async () => [{ type: adapter.type, connected: true, endpoint: adapter.endpoint, models: [] }],
  } as any;
}

export const testLoadShared = async () => ({
  completionToResponseRequest: ({ modelId, prompt, params }: any) => ({ model: modelId, input: prompt, providerOptions: { localai: { operation: 'completion', ...params } } }),
  chatToResponseRequest: ({ modelId, messages, params }: any) => ({
    model: modelId,
    input: (messages || []).map((m: any) => ({ type: 'message', role: m.role, content: [{ type: 'input_text', text: typeof m.content === 'string' ? m.content : (m.content?.text ?? '') }] })),
    providerOptions: { localai: { ...params } },
  }),
  responseOutputText: (studioResponse: any) => studioResponse.outputText ?? '',
  imageToResponseRequest: ({ modelId, prompt, negativePrompt, referenceImage, params }: any) => ({
    model: modelId,
    input: prompt,
    providerOptions: { localai: { image: params, referenceImage } },
  }),
  responseImages: (studioResponse: any) => studioResponse.output?.filter((i: any) => i.type === 'image_generation_call').map((it: any) => it.result) ?? [],
});
