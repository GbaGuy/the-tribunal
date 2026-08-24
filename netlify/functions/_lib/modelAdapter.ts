import type { ModelConfig } from './types';

export interface ModelCallResult {
  content: string;
  raw: unknown;
}

export async function callModel(
  modelConfig: ModelConfig,
  systemPrompt: string,
  userMessage: string
): Promise<ModelCallResult> {
  if (modelConfig.provider === 'openai-compatible') {
    return callOpenAiCompatible(modelConfig, systemPrompt, userMessage);
  }
  throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
}

async function callOpenAiCompatible(
  modelConfig: ModelConfig,
  systemPrompt: string,
  userMessage: string
): Promise<ModelCallResult> {
  const { baseUrl, model, apiKeyEnv } = modelConfig;
  if (!baseUrl || !model || !apiKeyEnv) {
    throw new Error('openai-compatible model config requires baseUrl, model, and apiKeyEnv');
  }

  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing environment variable: ${apiKeyEnv}`);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const raw = await response.json();

  if (!response.ok) {
    throw new Error(`Model call failed with status ${response.status}: ${JSON.stringify(raw)}`);
  }

  const content = (raw as any)?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`Unexpected response shape from model: ${JSON.stringify(raw)}`);
  }

  return { content, raw };
}
