// Cost estimation for cloud providers
// Prices are approximate USD per 1k tokens / per image / per second

interface TextPricing {
  inputPer1k: number;
  outputPer1k: number;
}

interface ImagePricing {
  perImage: number;
  perImageHD?: number;
}

export interface ProviderPricing {
  text: Record<string, TextPricing>;
  image?: Record<string, ImagePricing>;
}

export const CLOUD_PRICING: Record<string, ProviderPricing> = {
  openai: {
    text: {
      'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015 },
      'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
      'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
      'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
    },
    image: {
      'dall-e-3': { perImage: 0.04, perImageHD: 0.08 },
      'dall-e-2': { perImage: 0.02 },
    },
  },
  anthropic: {
    text: {
      'claude-3-5-sonnet-20241022': { inputPer1k: 0.003, outputPer1k: 0.015 },
      'claude-3-opus-20240229': { inputPer1k: 0.015, outputPer1k: 0.075 },
      'claude-3-haiku-20240307': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
    },
  },
  deepseek: {
    text: {
      'deepseek-chat': { inputPer1k: 0.0001, outputPer1k: 0.0002 },
      'deepseek-reasoner': { inputPer1k: 0.00055, outputPer1k: 0.00219 },
    },
  },
};

export type ProviderKey = string;
export type ModelKey = string;

export interface CostEstimate {
  provider: string;
  estimatedCost: number;
  currency: string;
}

// Estimate text generation cost
export function estimateTextCost(
  provider: ProviderKey,
  model: ModelKey,
  inputTokens: number,
  outputTokens: number
): number {
  const providerPricing = CLOUD_PRICING[provider];
  if (!providerPricing?.text) return 0;

  const modelPricing = providerPricing.text[model as keyof typeof providerPricing.text];
  if (!modelPricing) return 0;

  const inputCost = (inputTokens / 1000) * modelPricing.inputPer1k;
  const outputCost = (outputTokens / 1000) * modelPricing.outputPer1k;

  return inputCost + outputCost;
}

// Estimate image generation cost
export function estimateImageCost(
  provider: ProviderKey,
  model: ModelKey,
  width: number,
  height: number,
  n: number = 1
): number {
  const providerPricing = CLOUD_PRICING[provider];
  if (!providerPricing?.image) return 0;

  const modelPricing = providerPricing.image[model as keyof typeof providerPricing.image];
  if (!modelPricing) return 0;

  const isHD = width >= 1024 || height >= 1024;
  const perImage = isHD && modelPricing.perImageHD ? modelPricing.perImageHD : modelPricing.perImage;

  return perImage * n;
}

// Estimate workflow cost from node outputs
export function estimateWorkflowCost(
  provider: ProviderKey | undefined,
  model: ModelKey | undefined,
  nodeType: string,
  output?: Record<string, unknown>
): CostEstimate | null {
  if (!provider || !model) return null;

  const currency = 'USD';

  if (nodeType === 'model.text' && output?.text) {
    // Rough token estimate: 1 token ≈ 4 chars
    const inputTokens = 100; // Assume ~100 token input
    const outputTokens = (String(output.text).length / 4);
    const cost = estimateTextCost(provider, model, inputTokens, outputTokens);
    return { provider, estimatedCost: cost, currency };
  }

  if (nodeType === 'model.image' && output?.images) {
    const n = Array.isArray(output.images) ? output.images.length : 1;
    const cost = estimateImageCost(provider, model, 1024, 1024, n);
    return { provider, estimatedCost: cost, currency };
  }

  return null;
}