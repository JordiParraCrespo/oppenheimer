import { createServer, type Server, type ServerResponse } from 'node:http';

/**
 * A stand-in for the model that names a session from its first prompt.
 *
 * The namer is an OpenAI-compatible server — Groq, Together, vLLM, a local
 * Ollama — and a run here has none, so this serves the one endpoint the adapter
 * calls. What it proves is the wiring rather than the model: that the prompt
 * reaches the namer, that the answer is folded onto the session as a `model`
 * name, and that the sidebar stops showing the slug.
 *
 * It answers with a title derived from the prompt it was actually given, so a
 * request that carried the wrong text produces a visibly wrong name rather than
 * a canned string that would pass either way.
 */
export interface NamerStub {
  url: string;
  /** Every prompt the API asked about, in order. */
  prompts: string[];
  close: () => Promise<void>;
}

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

/** Six words, title-cased — the same brief the real system prompt gives. */
export function titleFor(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function startNamerStub(port = 0): Promise<NamerStub> {
  const prompts: string[] = [];

  const server: Server = createServer((request, response) => {
    if (!request.url?.endsWith('/chat/completions')) {
      return json(response, 404, { error: { message: `No stub for ${request.url}` } });
    }

    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}') as {
        messages?: { role: string; content: string }[];
      };
      const prompt = parsed.messages?.find((message) => message.role === 'user')?.content ?? '';
      prompts.push(prompt);
      json(response, 200, {
        choices: [{ message: { role: 'assistant', content: titleFor(prompt) } }],
      });
    });
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('stub has no port');

  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    prompts,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Run it on its own, the way the GitHub stub is run: before the API starts. */
if (process.argv[1]?.endsWith('namer-stub.ts')) {
  startNamerStub(Number(process.env.NAMER_STUB_PORT ?? 4320)).then((stub) => {
    console.log(`namer stub listening on ${stub.url}`);
  });
}
