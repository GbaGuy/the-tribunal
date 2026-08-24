export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}
