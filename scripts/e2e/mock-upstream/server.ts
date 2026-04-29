import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.MOCK_UPSTREAM_PORT || 11434);
const ROOT = dirname(new URL(import.meta.url).pathname);
const STATIC_DIR = join(ROOT, 'static');
const LOG_PATH = join(ROOT, 'mock_request.log');
const SAMPLE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const SAMPLE_PNG_BYTES = Buffer.from(SAMPLE_PNG_B64, 'base64');

type RequestSnapshot = {
  method: string;
  path: string;
  headers: Record<string, string>;
  json?: unknown;
  fields?: Record<string, string[]>;
  files?: Record<
    string,
    Array<{
      name: string;
      type: string;
      size: number;
    }>
  >;
};

let latestSnapshot: RequestSnapshot | null = null;
let forceError = false;

mkdirSync(STATIC_DIR, { recursive: true });
writeFileSync(join(STATIC_DIR, 'sample.png'), SAMPLE_PNG_BYTES);
writeFileSync(LOG_PATH, '');

const headersToObject = (headers: Headers) => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      'access-control-allow-origin': '*',
      ...(init?.headers || {}),
    },
  });

const imageResponse = (requestBody: Record<string, unknown>) => {
  const n = Math.max(1, Number(requestBody.n || 1));
  const prompt = String(requestBody.prompt || '');
  const responseFormat = String(requestBody.response_format || 'b64_json');
  const items = Array.from({ length: n }, () => ({
    revised_prompt: `mock revised: ${prompt}`,
    ...(responseFormat === 'url'
      ? { url: `http://127.0.0.1:${PORT}/static/sample.png` }
      : { b64_json: SAMPLE_PNG_B64 }),
  }));

  return jsonResponse({
    created: Math.floor(Date.now() / 1000),
    data: items,
  });
};

const recordSnapshot = (snapshot: RequestSnapshot) => {
  latestSnapshot = snapshot;
  appendFileSync(LOG_PATH, `${JSON.stringify(snapshot)}\n`);
};

const parseJsonRequest = async (request: Request, pathname: string) => {
  const body = await request.json().catch(() => ({}));
  recordSnapshot({
    method: request.method,
    path: pathname,
    headers: headersToObject(request.headers),
    json: body,
  });
  return body as Record<string, unknown>;
};

const parseFormRequest = async (request: Request, pathname: string) => {
  const form = await request.formData();
  const fields: Record<string, string[]> = {};
  const files: RequestSnapshot['files'] = {};
  const requestBody: Record<string, unknown> = {};

  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      files[key] ||= [];
      files[key].push({
        name: value.name,
        type: value.type,
        size: value.size,
      });
      continue;
    }
    fields[key] ||= [];
    fields[key].push(String(value));
    requestBody[key] = String(value);
  }

  recordSnapshot({
    method: request.method,
    path: pathname,
    headers: headersToObject(request.headers),
    fields,
    files,
  });

  return requestBody;
};

const chatCompletionResponse = async (request: Request, pathname: string) => {
  const body = await parseJsonRequest(request, pathname);
  if (body.stream === true) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: 'mock chat ok' } }],
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  }

  return jsonResponse({
    id: 'chatcmpl-e2e',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model || 'gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'mock chat ok' },
        finish_reason: 'stop',
      },
    ],
  });
};

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }

    if (pathname === '/healthz') {
      return jsonResponse({ ok: true });
    }

    if (pathname === '/__control') {
      const body = await request.json().catch(() => ({}));
      forceError = Boolean((body as { forceError?: boolean }).forceError);
      return jsonResponse({ ok: true, forceError });
    }

    if (pathname === '/v1/echo') {
      return jsonResponse({ ok: true, latest: latestSnapshot });
    }

    if (pathname === '/static/sample.png') {
      return new Response(SAMPLE_PNG_BYTES, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      });
    }

    if (forceError && pathname.startsWith('/v1/images/')) {
      recordSnapshot({
        method: request.method,
        path: pathname,
        headers: headersToObject(request.headers),
      });
      return jsonResponse(
        {
          error: {
            message: 'mock upstream forced error',
            type: 'server_error',
            code: 'mock_forced_error',
          },
        },
        { status: 502 },
      );
    }

    if (pathname === '/v1/images/generations') {
      const body = await parseJsonRequest(request, pathname);
      return imageResponse(body);
    }

    if (pathname === '/v1/images/edits') {
      const body = await parseFormRequest(request, pathname);
      return imageResponse(body);
    }

    if (pathname === '/v1/chat/completions') {
      return chatCompletionResponse(request, pathname);
    }

    return jsonResponse(
      {
        error: {
          message: `mock upstream route not found: ${pathname}`,
          type: 'not_found',
          code: 'not_found',
        },
      },
      { status: 404 },
    );
  },
});

console.log(`mock upstream listening on http://127.0.0.1:${PORT}`);
