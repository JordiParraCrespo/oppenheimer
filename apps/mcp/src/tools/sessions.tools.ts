import { randomUUID } from 'node:crypto';
import { FIELD_BOUNDS, fitsPromptBound } from '@oppenheimer/shared';
import { z } from 'zod';
import type { OppenheimerClient } from '../client';
import { defineTool } from './tool';

/** The coding agents a host launches (`CODING_AGENT_IDS` in `@oppenheimer/shared`). */
const AGENTS = ['claude-code', 'codex', 'opencode', 'grok', 'shell'] as const;

/** A tool call may hold the connection this long; the session keeps running past it. */
export const MAX_WAIT_SECONDS = 300;

/**
 * A prompt held to the API's own bound (bytes of UTF-8, not characters), so a
 * task too long is the tool's error, phrased for the model, before any call.
 */
export const promptInput = (what: string) =>
  z
    .string()
    .trim()
    .min(1)
    .refine(fitsPromptBound, {
      message: `Too long: at most ${FIELD_BOUNDS.prompt.maxBytes} bytes (UTF-8). Write a shorter brief and point at files rather than pasting them.`,
    })
    .describe(`${what} At most ${FIELD_BOUNDS.prompt.maxBytes} bytes.`);

const sessionId = z
  .string()
  .uuid()
  .describe('The session’s id (from list_sessions or start_session)');

interface SessionView {
  id: string;
  state: string;
  lifecycle: string;
}

interface ProjectView {
  id: string;
  defaultHostId?: string | null;
  defaultAgent?: string | null;
  repositories: {
    installationId: string;
    githubRepoId: string;
    repositoryFullName: string;
    baseBranch: string;
    isDefault: boolean;
  }[];
}

/** Whether a session has stopped needing time: through with its task, waiting on somebody, or ended. */
export function isSettled(session: Pick<SessionView, 'state' | 'lifecycle'>): boolean {
  if (session.lifecycle === 'failed' || session.lifecycle === 'resolved') return true;
  if (session.lifecycle === 'starting') return false;
  return session.state !== 'working';
}

/**
 * The body of `POST /sessions` for a task in a project's repository or a
 * folder on the host. Throws a sentence the agent can act on when the input
 * names nothing to run in or no host.
 */
export function sessionBody(input: {
  task: string;
  project?: ProjectView;
  repository?: string;
  folder?: string;
  host_id?: string;
  agent?: (typeof AGENTS)[number];
  name?: string;
  permission?: 'ask' | 'auto' | 'full';
}): Record<string, unknown> {
  const hostId = input.host_id ?? input.project?.defaultHostId ?? undefined;
  if (!hostId) {
    throw new Error(
      'No host_id given and the project has no default host. Ask which host (list_hosts).',
    );
  }
  const base = {
    hostId,
    agent: input.agent ?? input.project?.defaultAgent ?? 'claude-code',
    projectId: input.project?.id,
    name: input.name,
    prompt: input.task,
    ...(input.permission ? { launch: { permission: input.permission } } : {}),
  };
  if (input.folder) return { ...base, folder: input.folder };
  if (!input.project) {
    throw new Error(
      'Give a project_id (to work in one of its repositories) or a folder on the host.',
    );
  }
  const wanted = input.repository?.toLowerCase();
  const repository = wanted
    ? input.project.repositories.find(
        (candidate) => candidate.repositoryFullName.toLowerCase() === wanted,
      )
    : (input.project.repositories.find((candidate) => candidate.isDefault) ??
      input.project.repositories[0]);
  if (!repository) {
    throw new Error(
      wanted
        ? `The project has no repository ${input.repository}; list_projects shows its repositories.`
        : 'The project has no repositories; give a folder instead, or a project that has one.',
    );
  }
  const githubRepoId = Number(repository.githubRepoId);
  return {
    ...base,
    checkouts: [
      {
        installationId: repository.installationId,
        githubRepoId,
        baseBranch: repository.baseBranch,
      },
    ],
    cwdGithubRepoId: githubRepoId,
  };
}

/** Poll a session until it settles or `seconds` pass. */
export async function waitForSession(
  client: OppenheimerClient,
  id: string,
  seconds: number,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<{ settled: boolean; session: SessionView }> {
  const deadline = Date.now() + seconds * 1_000;
  for (;;) {
    const session = await client.get<SessionView>(`/sessions/${id}`);
    if (isSettled(session)) return { settled: true, session };
    if (Date.now() + 3_000 > deadline) return { settled: false, session };
    await sleep(3_000);
  }
}

export const sessionTools = [
  defineTool({
    name: 'list_sessions',
    title: 'List sessions',
    description:
      'List sessions, most recent first: each one’s id, name, agent, host, repository, and `state` — working, waiting-on-you (a question, a permission or a failure), ready-for-review, landing, idle or resolved. Open sessions only unless include_closed.',
    requiredScopes: ['sessions:read'],
    inputSchema: z.object({
      host_id: z.string().uuid().optional().describe('Only sessions on this host'),
      project_id: z.string().uuid().optional().describe('Only sessions in this project'),
      include_closed: z.boolean().optional().describe('Include closed sessions'),
      limit: z.number().int().min(1).max(100).optional().describe('Page size, max 100'),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (args, { client }) =>
      client.get('/sessions', {
        hostId: args.host_id,
        projectId: args.project_id,
        state: args.include_closed ? undefined : 'open',
        limit: args.limit ?? 25,
        sort: 'recent',
      }),
  }),

  defineTool({
    name: 'get_session',
    title: 'Get a session',
    description:
      'Read one session: its state, what its agent last reported (`agentReport`), and what it waits on (`decision`: a question or a permission dialog, answered in the console).',
    requiredScopes: ['sessions:read'],
    inputSchema: z.object({ session_id: sessionId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ session_id }, { client }) => client.get(`/sessions/${session_id}`),
  }),

  defineTool({
    name: 'start_session',
    title: 'Start a session',
    description:
      'Start a coding agent (Claude Code by default) on a host with a task: in a new worktree of one of a project’s repositories, or in a folder already on the host. Returns at once with the session; the agent works on its own, so follow it with wait_for_session or get_session. The host defaults to the project’s default host. The person sees the session in their console.',
    requiredScopes: ['sessions:write', 'projects:read'],
    inputSchema: z.object({
      task: promptInput(
        'What the agent should do: it starts with only this, so make it a focused brief.',
      ),
      project_id: z.string().uuid().optional().describe('The project whose repository to work in'),
      repository: z
        .string()
        .max(200)
        .optional()
        .describe('owner/name of one of the project’s repositories; its default one when omitted'),
      folder: z
        .string()
        .max(1_024)
        .optional()
        .describe('Instead of a repository: an absolute path to a folder already on the host'),
      host_id: z.string().uuid().optional().describe('The host to run on (from list_hosts)'),
      agent: z.enum(AGENTS).optional().describe('Which coding agent; claude-code when omitted'),
      name: z.string().min(1).max(80).optional().describe('A short name for the session'),
      permission: z
        .enum(['ask', 'auto', 'full'])
        .optional()
        .describe('What the agent may do without asking; ask when omitted'),
    }),
    handler: async (args, { client }) => {
      const project = args.project_id
        ? await client.get<ProjectView>(`/projects/${args.project_id}`)
        : undefined;
      const body = sessionBody({ ...args, project });
      return client.post('/sessions', body, { 'idempotency-key': randomUUID() });
    },
  }),

  defineTool({
    name: 'send_to_session',
    title: 'Send a prompt to a session',
    description:
      'Type a follow-up prompt into a running session’s agent: more instructions, a correction, the next step. Only while the agent waits at its prompt (state idle or ready-for-review); while it works, wait_for_session first. The session’s log records the prompt as the person’s, sent through this connection.',
    requiredScopes: ['sessions:write'],
    inputSchema: z.object({
      session_id: sessionId,
      text: promptInput('What to tell the agent.'),
    }),
    handler: ({ session_id, text }, { client }) =>
      client.post(`/sessions/${session_id}/prompt`, { text }),
  }),

  defineTool({
    name: 'wait_for_session',
    title: 'Wait for a session',
    description: `Wait until a session's agent is through with its task or needs somebody, for at most wait_seconds (max ${MAX_WAIT_SECONDS}). Answers \`settled\` and the session; when settled is false it is still working, so call again. A state of waiting-on-you means it asks a question or a permission: tell the person.`,
    requiredScopes: ['sessions:read'],
    inputSchema: z.object({
      session_id: sessionId,
      wait_seconds: z.number().int().min(0).max(MAX_WAIT_SECONDS).default(120),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ session_id, wait_seconds }, { client }) =>
      waitForSession(client, session_id, wait_seconds),
  }),

  defineTool({
    name: 'stop_session',
    title: 'Stop a session',
    description:
      'Stop a session’s agent. Its worktree and branch stay; the person can restart it from the console.',
    requiredScopes: ['sessions:write'],
    inputSchema: z.object({ session_id: sessionId }),
    annotations: { idempotentHint: true },
    handler: ({ session_id }, { client }) => client.post(`/sessions/${session_id}/stop`),
  }),

  defineTool({
    name: 'close_session',
    title: 'Close a session',
    description:
      'Close a session: end its terminal and remove its worktree. Work never pushed is refused unless accept_unpushed_work. This cannot be undone — confirm with the person first.',
    requiredScopes: ['sessions:write'],
    inputSchema: z.object({
      session_id: sessionId,
      accept_unpushed_work: z.boolean().optional().describe('Close even with unpushed commits'),
    }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: ({ session_id, accept_unpushed_work }, { client }) =>
      client.delete(`/sessions/${session_id}`, {
        acceptUnpushedWork: accept_unpushed_work ? true : undefined,
      }),
  }),
];
