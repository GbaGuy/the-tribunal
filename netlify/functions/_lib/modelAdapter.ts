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
  const { base_url, model, api_key_env } = modelConfig;
  if (!base_url || !model) {
    throw new Error('openai-compatible model config requires base_url and model');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (api_key_env) {
    const apiKey = process.env[api_key_env];
    if (!apiKey) {
      throw new Error(`Missing environment variable: ${api_key_env}`);
    }
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${base_url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Model call failed with status ${response.status}: ${bodyText}`);
  }

  const raw = await response.json();
  const content = (raw as any)?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`Unexpected response shape from model: ${JSON.stringify(raw)}`);
  }

  return { content, raw };
}
