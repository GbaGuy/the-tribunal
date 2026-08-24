export interface ModelCatalogEntry {
  id: string;
  label: string;
  provider: 'openai-compatible';
  base_url: string;
  model: string;
  api_key_env: string;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'groq-llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant (Groq)',
    provider: 'openai-compatible',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    api_key_env: 'GROQ_API_KEY',
  },
  {
    id: 'groq-llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile (Groq)',
    provider: 'openai-compatible',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    api_key_env: 'GROQ_API_KEY',
  },
  {
    id: 'groq-gpt-oss-120b',
    label: 'GPT-OSS 120B (Groq)',
    provider: 'openai-compatible',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    api_key_env: 'GROQ_API_KEY',
  },
  {
    id: 'groq-gpt-oss-20b',
    label: 'GPT-OSS 20B (Groq)',
    provider: 'openai-compatible',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-20b',
    api_key_env: 'GROQ_API_KEY',
  },
  {
    id: 'groq-compound',
    label: 'Compound (Groq)',
    provider: 'openai-compatible',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'groq/compound',
    api_key_env: 'GROQ_API_KEY',
  },
  {
    id: 'groq-compound-mini',
    label: 'Compound Mini (Groq)',
    provider: 'openai-compatible',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'groq/compound-mini',
    api_key_env: 'GROQ_API_KEY',
  },
];
