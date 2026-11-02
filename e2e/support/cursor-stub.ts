import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * A stand-in for Cursor's Cloud Agents API (`api.cursor.com/v1`), the cloud
 * agents module's first provider (`product/next-steps/cloud-agents.md`).
 *
 * It serves the calls the API makes, in Cursor's own shapes: who a key is,
 * the models, the repositories, and an agent whose run plays out on its own
 * clock (`CREATING`, then `RUNNING` after a second, then `FINISHED` with a
 * pushed branch after `RUN_MS`), a follow-up refused while a run is going
 * (`agent_busy`), and a stop. What it proves is the wiring: the key reaching
 * Cursor as Basic auth, our id becoming Cursor's agent id, and Cursor's
 * answers reaching the console in our words.
 *
 * A key is accepted when it starts with {@link STUB_KEY_PREFIX}; any other is
 * Cursor's 401, so a suite can show a refused key. A prompt containing
 * {@link REFUSE_MARKER} is refused the way Cursor refuses a launch it cannot
 * run, with Cursor's words.
 */
export const STUB_KEY_PREFIX = 'crsr_stub_';
export const REFUSE_MARKER = '[refuse]';
const RUN_MS = Number(process.env.CURSOR_STUB_RUN_MS ?? 6_000);

interface StubRun {
  id: string;
  createdAt: number;
  prompt: string;
  cancelled: boolean;
}

interface StubAgent {
  id: string;
  name: string;
  repositoryUrl: string;
  runs: StubRun[];
}

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function refuse(response: ServerResponse, status: number, code: string, message: string) {
  json(response, status, { error: { code, message } });
}

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The key a request carries as Basic auth (the key as user, no password), or none. */
function keyOf(request: IncomingMessage): string | null {
  const header = request.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (!header.startsWith('Basic ')) return null;
  return Buffer.from(header.slice(6), 'base64').toString().replace(/:$/, '');
}

function statusOf(run: StubRun, now: number): string {
  if (run.cancelled) return 'CANCELLED';
  const age = now - run.createdAt;
  if (age < 1_000) return 'CREATING';
  return age < RUN_MS ? 'RUNNING' : 'FINISHED';
}

function slugOf(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'task'
  );
}

/** A run as Cursor answers it; `git` is the agent's and appears once it pushed. */
function runBody(agent: StubAgent, run: StubRun, now: number) {
  const status = statusOf(run, now);
  const ended = status === 'FINISHED' || status === 'CANCELLED';
  const pushed = agent.runs.some((each) => statusOf(each, now) === 'FINISHED');
  return {
    id: run.id,
    agentId: agent.id,
    status,
    createdAt: new Date(run.createdAt).toISOString(),
    updatedAt: new Date(now).toISOString(),
    ...(ended && status === 'FINISHED'
      ? { result: `Done: ${run.prompt.slice(0, 120)}`, durationMs: RUN_MS }
      : {}),
    ...(pushed
      ? {
          git: {
            branches: [
              {
                repoUrl: agent.repositoryUrl.replace(/^https:\/\//, ''),
                branch: `cursor/${slugOf(agent.name)}`,
              },
            ],
          },
        }
      : {}),
  };
}

export interface CursorStub {
  url: string;
  close: () => Promise<void>;
}

export async function startCursorStub(port = 0): Promise<CursorStub> {
  const agents = new Map<string, StubAgent>();
  let runs = 0;

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://stub');
    const path = url.pathname;
    const key = keyOf(request);
    if (!key?.startsWith(STUB_KEY_PREFIX)) {
      return json(response, 401, { code: 'error', message: 'Invalid User API Key' });
    }
    const now = Date.now();

    if (request.method === 'GET' && path === '/v1/me') {
      return json(response, 200, {
        apiKeyName: 'Stub key',
        userId: 4242,
        createdAt: new Date(now).toISOString(),
        userEmail: 'stub@cursor.test',
      });
    }
    if (request.method === 'GET' && path === '/v1/models') {
      return json(response, 200, {
        items: [
          { id: 'default', displayName: 'Auto' },
          { id: 'grok-4.7', displayName: 'Grok 4.7' },
          { id: 'composer-2.5', displayName: 'Composer 2.5' },
          { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
        ],
      });
    }
    if (request.method === 'GET' && path === '/v1/repositories') {
      return json(response, 200, {
        items: [
          { url: 'https://github.com/acme/api' },
          { url: 'https://github.com/acme/web' },
          { url: 'https://github.com/acme/infra' },
        ],
      });
    }
    if (request.method === 'POST' && path === '/v1/agents') {
      const body = await bodyOf(request);
      const prompt = String((body.prompt as { text?: unknown })?.text ?? '');
      if (prompt.includes(REFUSE_MARKER)) {
        return refuse(response, 400, 'validation_error', 'Repository is not accessible');
      }
      const id = typeof body.agentId === 'string' ? body.agentId : `bc-stub-${agents.size + 1}`;
      if (agents.has(id)) return refuse(response, 409, 'agent_id_conflict', 'Agent id in use');
      const repositoryUrl = String((body.repos as { url?: unknown }[])?.[0]?.url ?? '');
      runs += 1;
      const run: StubRun = { id: `run-${runs}`, createdAt: now, prompt, cancelled: false };
      const agent: StubAgent = {
        id,
        name: prompt.split(/[.\n]/)[0].slice(0, 80) || 'Cloud agent',
        repositoryUrl,
        runs: [run],
      };
      agents.set(id, agent);
      return json(response, 201, {
        agent: {
          id,
          name: agent.name,
          status: 'ACTIVE',
          url: `https://cursor.com/agents?id=${id}`,
          latestRunId: run.id,
        },
        run: { id: run.id, agentId: id, status: 'CREATING' },
      });
    }

    const match = /^\/v1\/agents\/([^/]+)\/runs(?:\/([^/]+)(\/cancel)?)?$/.exec(path);
    const agent = match ? agents.get(decodeURIComponent(match[1])) : undefined;
    if (match && !agent) return refuse(response, 404, 'agent_not_found', 'Agent not found');
    if (match && agent) {
      const [, , runId, cancel] = match;
      const latest = agent.runs[agent.runs.length - 1];
      if (request.method === 'POST' && !runId) {
        const busy = ['CREATING', 'RUNNING'].includes(statusOf(latest, now));
        if (busy) return refuse(response, 409, 'agent_busy', 'The agent is still running');
        const body = await bodyOf(request);
        runs += 1;
        const run: StubRun = {
          id: `run-${runs}`,
          createdAt: now,
          prompt: String((body.prompt as { text?: unknown })?.text ?? ''),
          cancelled: false,
        };
        agent.runs.push(run);
        return json(response, 201, { run: { id: run.id, agentId: agent.id, status: 'CREATING' } });
      }
      const run = agent.runs.find((each) => each.id === runId);
      if (!run) return refuse(response, 404, 'run_not_found', 'Run not found');
      if (request.method === 'POST' && cancel) {
        if (!['CREATING', 'RUNNING'].includes(statusOf(run, now))) {
          return refuse(response, 409, 'run_not_cancellable', 'The run already ended');
        }
        run.cancelled = true;
        return json(response, 200, { id: run.id });
      }
      if (request.method === 'GET' && !cancel) return json(response, 200, runBody(agent, run, now));
    }
    return refuse(response, 404, 'not_found', `No stub for ${request.method} ${path}`);
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${bound}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Run it on its own, the way the GitHub stub is run: before the API starts. */
if (process.argv[1]?.endsWith('cursor-stub.ts')) {
  startCursorStub(Number(process.env.CURSOR_STUB_PORT ?? 4321)).then((stub) => {
    console.log(`cursor stub listening on ${stub.url}`);
  });
}
