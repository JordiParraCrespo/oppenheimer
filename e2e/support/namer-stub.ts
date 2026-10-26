import { createServer, type Server, type ServerResponse } from 'node:http';

/**
 * A stand-in for the model that names a session from its first prompt, and
 * for the deployment's speech-to-text server (`VOICE_STT_*`).
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
  /** The size of every clip the API sent to be transcribed, in order. */
  clips: number[];
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

/**
 * What the stub hears in every clip: a dictation with a filler in it, so a
 * transcript that reaches the field polished proves the tidy ran, and one
 * that reaches it as heard proves it did not.
 */
export const STUB_TRANSCRIPT = 'um so fix the login redirect loop in apps web';

/** The tidy's brief, which the stub answers by tidying rather than naming. */
const POLISH_MARKER = 'You turn dictated speech';

/** What the stub's tidy makes of a transcript: fillers gone, a capital and a full stop. */
export function tidied(transcript: string): string {
  const words = transcript
    .replace(/\b(um+|uh+|so)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .join(' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

/** At most six words, first letter capitalised — the same brief the real system prompt gives. */
export function titleFor(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function startNamerStub(port = 0): Promise<NamerStub> {
  const prompts: string[] = [];
  const clips: number[] = [];

  const server: Server = createServer((request, response) => {
    if (request.url?.endsWith('/audio/transcriptions')) {
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
      });
      request.on('end', () => {
        clips.push(size);
        json(response, 200, { text: STUB_TRANSCRIPT });
      });
      return;
    }
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
      const system = parsed.messages?.find((message) => message.role === 'system')?.content ?? '';
      if (system.startsWith(POLISH_MARKER)) {
        const transcript = /<transcript>\n([\s\S]*)\n<\/transcript>/.exec(prompt)?.[1] ?? '';
        return json(response, 200, {
          choices: [{ message: { role: 'assistant', content: tidied(transcript) } }],
        });
      }
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
    clips,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Run it on its own, the way the GitHub stub is run: before the API starts. */
if (process.argv[1]?.endsWith('namer-stub.ts')) {
  startNamerStub(Number(process.env.NAMER_STUB_PORT ?? 4320)).then((stub) => {
    console.log(`namer stub listening on ${stub.url}`);
  });
}
