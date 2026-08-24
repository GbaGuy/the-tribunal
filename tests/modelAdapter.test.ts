import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callModel } from '../netlify/functions/_lib/modelAdapter';

describe('callModel', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TEST_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('returns content from a successful openai-compatible response', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'I did what honor required.' } }] }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const result = await callModel(
      { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
      'You are Jon Snow.',
      'Was the killing justified?'
    );

    expect(result.content).toBe('I did what honor required.');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the API responds with a non-2xx status', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    ) as unknown as typeof fetch;

    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
        'You are Jon Snow.',
        'Was the killing justified?'
      )
    ).rejects.toThrow(/429/);
  });

  it('throws when the response has no message content', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
        'sys',
        'user'
      )
    ).rejects.toThrow(/Unexpected response shape/);
  });

  it('throws when the required env var is missing', async () => {
    delete process.env.MISSING_KEY;
    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'MISSING_KEY' },
        'sys',
        'user'
      )
    ).rejects.toThrow(/MISSING_KEY/);
  });

  it('throws for an unsupported provider', async () => {
    await expect(callModel({ provider: 'todo' } as any, 'sys', 'user')).rejects.toThrow(
      /Unsupported model provider/
    );
  });

  it('throws with the raw response body when a non-2xx response is not valid JSON', async () => {
    global.fetch = vi.fn(async () =>
      new Response('<html><body>Bad Gateway</body></html>', { status: 502 })
    ) as unknown as typeof fetch;

    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
        'sys',
        'user'
      )
    ).rejects.toThrow(/502/);
  });
});
