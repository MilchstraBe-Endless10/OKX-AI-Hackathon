/* global AbortSignal, console, fetch, performance, process */

const base = (
  process.argv[2] === '--'
    ? process.argv[3]
    : (process.argv[2] ?? process.env.SOPSCAPE_PUBLIC_URL ?? '')
).replace(/\/$/, '');
if (!base.startsWith('https://')) {
  throw new Error('Pass an HTTPS URL: pnpm verify:listing -- https://example.com');
}

const checks = [];

async function request(name, path, expectedStatus, init) {
  const startedAt = performance.now();
  const response = await fetch(`${base}${path}`, {
    ...init,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  checks.push({
    name,
    ok: response.status === expectedStatus,
    status: response.status,
    expectedStatus,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return { response, body };
}

await request('live', '/health/live', 200);
await request('ready', '/health/ready', 200);
await request('SPA', '/', 200);

await request('invalid input', '/a2mcp/generate-rehearsal', 400, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: '', content: '' }),
});

const valid = await request('free A2MCP', '/a2mcp/generate-rehearsal', 200, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    title: 'Phishing email response',
    content:
      'Do not click embedded links. Verify the sender independently, preserve evidence, and report the message to the security team.',
  }),
});
const result = JSON.parse(valid.body);
checks.push({
  name: 'structured result',
  ok:
    typeof result.rehearsalId === 'string' &&
    Array.isArray(result.consensus) &&
    Array.isArray(result.decisionNodes),
});
checks.push({
  name: 'free endpoint has no payment challenge',
  ok: !valid.response.headers.has('payment-required'),
});

await request('protected MCP', '/mcp', 401, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
});

console.table(checks);
if (checks.some(({ ok }) => !ok)) process.exitCode = 1;
