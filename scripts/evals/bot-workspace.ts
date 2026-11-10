// A workspace in memory for the bot evals that read hosts and sessions
// (`bot-skills`, `bot-session-search`): the hosts, projects and sessions a
// case file names, behind the queries the API's own bot tools dispatch. The
// tools themselves are production's (`BotHostToolsFactory`,
// `BotPlanToolsFactory`, `BotSessionToolsFactory`), constructed over these
// doubles of their buses and bound to a turn the way the toolbox binds them,
// so the model reads exactly the words a bot reads. Only the database is
// stood in for: the sessions are real `WorkSessionEntity` folds of the case's
// log, and the search is a plain word match over the words the real search
// indexes (`sessionSearchText`).
import { randomUUID } from 'node:crypto';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BotHostToolsFactory } from '../../apps/api/src/bots-chat/application/bot-host-tools.factory';
import { BotPlanToolsFactory } from '../../apps/api/src/bots-chat/application/bot-plan-tools.factory';
import { BotSessionToolsFactory } from '../../apps/api/src/bots-chat/application/bot-session-tools.factory';
import type {
  BotToolContext,
  BotToolDefinition,
} from '../../apps/api/src/bots-chat/application/bot-tool.factory';
import { NO_PERMISSIONS } from '../../apps/api/src/bots-chat/domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../apps/api/src/bots-chat/domain/bot-turn-budget.policy';
import { FindHostQuery } from '../../apps/api/src/hosts/queries/find-host/find-host.query';
import { FindHostsQuery } from '../../apps/api/src/hosts/queries/find-hosts/find-hosts.query';
import { FindProjectsQuery } from '../../apps/api/src/projects/queries/find-projects/find-projects.query';
import type { SessionSearchMatch } from '../../apps/api/src/sessions/database/work-session.repository.port';
import {
  SESSION_NAME_HIT,
  sessionSearchText,
} from '../../apps/api/src/sessions/domain/session-search.policy';
import { SessionErrors } from '../../apps/api/src/sessions/domain/sessions.errors';
import { WorkSessionEntity } from '../../apps/api/src/sessions/domain/work-session.entity';
import { WorkSessionEventEntity } from '../../apps/api/src/sessions/domain/work-session-event.entity';
import { FindLatestSessionEventsQuery } from '../../apps/api/src/sessions/queries/find-latest-session-events/find-latest-session-events.query';
import { FindSessionQuery } from '../../apps/api/src/sessions/queries/find-session/find-session.query';
import { FindSessionEventsQuery } from '../../apps/api/src/sessions/queries/find-session-events/find-session-events.query';
import { FindSessionTranscriptQuery } from '../../apps/api/src/sessions/queries/find-session-transcript/find-session-transcript.query';
import { FindSessionsQuery } from '../../apps/api/src/sessions/queries/find-sessions/find-sessions.query';
import { SearchSessionsQuery } from '../../apps/api/src/sessions/queries/search-sessions/search-sessions.query';
import { type EvalTool, fromApi } from './bot-turn';

const { emptyScope } = fromApi(
  '@oppenheimer/backend-authz',
) as typeof import('@oppenheimer/backend-authz');
const { AppError } = fromApi(
  '@oppenheimer/backend-core',
) as typeof import('@oppenheimer/backend-core');

export interface HostSpec {
  id: string;
  name: string;
  online: boolean;
  runningSessions?: number;
  os?: string;
  runnerVersion?: string;
}

export interface ProjectSpec {
  id: string;
  name: string;
}

/**
 * One entry of a session's log: a raw `{ kind, payload }`, or a shorthand
 * for the kinds a case writes most (`prompt`, `result`, `observed`, `note`,
 * `failed`, `started`, `closed`, `named`).
 */
export interface LogSpec {
  at: string;
  kind?: string;
  payload?: unknown;
  prompt?: string;
  result?: string;
  observed?: string;
  note?: string;
  failed?: string;
  started?: true;
  closed?: true;
  named?: string;
}

export interface SessionSpec {
  id: string;
  name: string;
  host: string;
  project: string;
  agent?: string;
  branch?: string;
  log: LogSpec[];
  /** What `read_session_transcript` reads: the agent's conversation, by role. */
  transcript?: { at: string; role: 'user' | 'assistant'; text: string; tool?: string }[];
}

export interface WorkspaceSpec {
  hosts: HostSpec[];
  projects: ProjectSpec[];
  sessions?: SessionSpec[];
  /** The bot's home host, by name. */
  home?: string;
}

/** What a `run_command` stand-in, or any write stand-in, saw: the calls are scored, not run. */
export interface Workspace {
  /** The bound production tools, by name, among those `names` asked for. */
  tools(names: readonly string[]): EvalTool[];
  /** The definitions themselves, for the prompt's list and for a stand-in's schema. */
  definitions: readonly { group: string; definition: BotToolDefinition }[];
  hostById(id: string): HostSpec | undefined;
  hostByName(name: string): HostSpec | undefined;
  context: BotToolContext;
  sessions: readonly WorkSessionEntity[];
}

const owner = emptyScope('owner-1', 'org-1');

function entryOf(spec: LogSpec): { kind: string; payload: unknown } {
  if (spec.kind) return { kind: spec.kind, payload: spec.payload ?? {} };
  if (spec.prompt !== undefined) return { kind: 'prompt.first', payload: { text: spec.prompt } };
  if (spec.result !== undefined) {
    return { kind: 'turn.ended', payload: { exitCode: 0, result: spec.result } };
  }
  if (spec.observed !== undefined) {
    return { kind: 'agent.observed', payload: { state: spec.observed } };
  }
  if (spec.note !== undefined) {
    return { kind: 'agent.notified', payload: { id: randomUUID().slice(0, 8), text: spec.note } };
  }
  if (spec.failed !== undefined)
    return { kind: 'session.failed', payload: { detail: spec.failed } };
  if (spec.named !== undefined) {
    return { kind: 'session.named', payload: { name: spec.named, source: 'user' } };
  }
  if (spec.started) return { kind: 'session.started', payload: {} };
  if (spec.closed) return { kind: 'session.closed', payload: {} };
  throw new Error(`A log entry with nothing in it: ${JSON.stringify(spec)}`);
}

/** The session the case describes, folded from its log as the API folds one. */
function sessionOf(
  spec: SessionSpec,
  spaceSpec: WorkspaceSpec,
): { session: WorkSessionEntity; events: WorkSessionEventEntity[] } {
  const host = spaceSpec.hosts.find((candidate) => candidate.name === spec.host);
  const project = spaceSpec.projects.find((candidate) => candidate.name === spec.project);
  if (!host || !project) throw new Error(`Session ${spec.name}: no host or project by that name.`);
  const session = WorkSessionEntity.request({
    organizationId: 'org-1',
    projectId: project.id,
    createdByUserId: 'owner-1',
    hostId: host.id,
    // `<adjective>-<noun>-<6 base36>`, as the namer mints them; the case's id makes it unique.
    slug: `quiet-otter-${spec.id.replace(/-/g, '').slice(-6)}`,
    agent: (spec.agent ?? 'claude-code') as never,
    name: spec.name,
  });
  // The entity's id is its own; the case's id is the one the model reads.
  (session as unknown as { _id: string })._id = spec.id;
  const events = spec.log.map((entry, at) => {
    const { kind, payload } = entryOf(entry);
    return WorkSessionEventEntity.createNew({
      sessionId: spec.id,
      seq: at + 1,
      idempotencyKey: `eval:${at + 1}`,
      source: 'runner',
      kind,
      payload,
      occurredAt: new Date(entry.at),
    });
  });
  session.recordEvents(events);
  return { session, events };
}

/** A query's words as the search reads them: lower case, split on what is not a letter or digit. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

type Term = { any: string[][]; not?: false } | { word: string; not: true };

/**
 * Web-search syntax as `websearch_to_tsquery('simple', …)` reads it, well
 * enough for the cases: every term must match (no stemming, no stop words),
 * a quoted phrase as consecutive words, `-word` excluded, `a OR b` either.
 */
function parseQuery(query: string): Term[] {
  const tokens = query.match(/-?"[^"]*"|\S+/g) ?? [];
  const terms: Term[] = [];
  let or = false;
  for (const token of tokens) {
    if (token === 'OR') {
      or = true;
      continue;
    }
    if (token.startsWith('-') && token.length > 1) {
      for (const word of words(token.slice(1))) terms.push({ word, not: true });
      or = false;
      continue;
    }
    const quoted = token.startsWith('"');
    const parts = words(token);
    if (parts.length === 0) continue;
    const alternatives = quoted ? [parts] : parts.map((part) => [part]);
    const last = terms.at(-1);
    if (or && last && !last.not) {
      last.any.push(...alternatives);
    } else if (quoted) {
      terms.push({ any: alternatives });
    } else {
      for (const alternative of alternatives) terms.push({ any: [alternative] });
    }
    or = false;
  }
  return terms;
}

function hasPhrase(text: string[], phrase: string[]): number {
  let count = 0;
  for (let at = 0; at + phrase.length <= text.length; at++) {
    if (phrase.every((word, offset) => text[at + offset] === word)) count++;
  }
  return count;
}

/** How well one entry's words match: 0 when they do not, else the matches counted. */
function rank(text: string, terms: Term[]): number {
  const tokens = words(text);
  let score = 0;
  for (const term of terms) {
    if (term.not) {
      if (tokens.includes(term.word)) return 0;
      continue;
    }
    const found = term.any.reduce((sum, phrase) => sum + hasPhrase(tokens, phrase), 0);
    if (found === 0) return 0;
    score += found;
  }
  return terms.some((term) => !term.not) ? score : 0;
}

/** Builds the workspace and the turn context its tools are bound to. */
export function workspace(spec: WorkspaceSpec): Workspace {
  const folded = (spec.sessions ?? []).map((session) => sessionOf(session, spec));
  const sessions = folded.map(({ session }) => session);
  const eventsOf = new Map(folded.map(({ session, events }) => [session.id, events]));
  const transcripts = new Map((spec.sessions ?? []).map((s) => [s.id, s.transcript ?? []]));
  const hostView = (host: HostSpec) => ({
    host: { id: host.id, name: host.name, runnerVersion: host.runnerVersion ?? '0.9.4' },
    online: host.online,
    runningSessions: host.runningSessions ?? 0,
    inventory: {
      osName: host.os ?? 'Ubuntu 24.04',
      platform: 'linux',
      tools: [{ name: 'claude', path: '/usr/local/bin/claude', required: false }],
    },
    vitals: { lastSeenAt: new Date('2026-11-09T09:58:00Z') },
  });
  const projectView = (project: ProjectSpec) => ({
    id: project.id,
    name: project.name,
    repositories: [],
    defaultHostId: null,
    defaultAgent: null,
    isUnassigned: false,
    archivedAt: null,
  });
  const find = (id: string) => {
    const session = sessions.find((candidate) => candidate.id === id);
    if (!session) throw new AppError(SessionErrors.NOT_FOUND, { detail: `No session ${id}` });
    return session;
  };
  const newestFirst = (list: WorkSessionEntity[]) =>
    [...list].sort((a, b) => (b.lastEventAt?.getTime() ?? 0) - (a.lastEventAt?.getTime() ?? 0));

  const search = ({ criteria: query }: SearchSessionsQuery): SessionSearchMatch[] => {
    const terms = parseQuery(query.query);
    const matches = sessions
      .filter((session) => !query.hostId || session.hostId === query.hostId)
      .filter((session) => !query.projectId || session.projectId === query.projectId)
      .flatMap((session) => {
        const since = query.since?.getTime() ?? Number.NEGATIVE_INFINITY;
        const last = session.lastEventAt ?? new Date(0);
        const named =
          last.getTime() >= since
            ? [{ kind: SESSION_NAME_HIT, at: last, text: session.name, seq: 0 }]
            : [];
        const logged = (eventsOf.get(session.id) ?? [])
          .filter((event) => event.occurredAt.getTime() >= since)
          .map((event) => ({
            kind: event.kind,
            at: event.occurredAt,
            text: sessionSearchText(event.kind, event.payload),
            seq: event.seq,
          }));
        const hits = [...named, ...logged]
          .map((hit) => ({ ...hit, rank: hit.text ? rank(hit.text, terms) : 0 }))
          .filter((hit) => hit.rank > 0)
          .sort((a, b) => b.rank - a.rank || b.at.getTime() - a.at.getTime() || b.seq - a.seq);
        const best = hits[0];
        return best ? [{ session, best, hits: hits.slice(0, 2) }] : [];
      })
      .sort((a, b) => b.best.rank - a.best.rank || b.best.at.getTime() - a.best.at.getTime())
      .slice(0, query.limit);
    return matches.map(({ session, hits }) => ({
      session,
      hits: hits.map(({ kind, at, text }) => ({ kind, at, text })),
    }));
  };

  const answer = (query: unknown): unknown => {
    if (query instanceof FindHostsQuery) return spec.hosts.map(hostView);
    if (query instanceof FindHostQuery) {
      const host = spec.hosts.find((candidate) => candidate.id === query.hostId);
      if (!host) throw new Error('No such host');
      return hostView(host);
    }
    if (query instanceof FindProjectsQuery) return spec.projects.map(projectView);
    if (query instanceof FindSessionsQuery) {
      const listed = newestFirst(sessions)
        .filter((session) => !query.projectId || session.projectId === query.projectId)
        .filter((session) => !query.hostId || session.hostId === query.hostId)
        .filter((session) => !query.state || session.state === query.state);
      return { data: listed.slice(0, query.limit), total: listed.length };
    }
    if (query instanceof FindSessionQuery) return find(query.sessionId);
    if (query instanceof FindLatestSessionEventsQuery) {
      const session = find(query.sessionId);
      return { session, events: (eventsOf.get(session.id) ?? []).slice(-query.limit) };
    }
    if (query instanceof FindSessionEventsQuery) {
      const after = (eventsOf.get(find(query.sessionId).id) ?? []).filter(
        (event) => event.seq > (query.afterSeq ?? 0),
      );
      return { events: after.slice(0, query.limit), nextSeq: null };
    }
    if (query instanceof FindSessionTranscriptQuery) {
      const entries = (transcripts.get(find(query.sessionId).id) ?? []).map((entry, at) => ({
        id: `t${at}`,
        at: entry.at,
        role: entry.role,
        parts: [
          entry.tool
            ? {
                kind: 'tool_call',
                text: entry.text,
                tool: entry.tool,
                isError: false,
                truncated: false,
              }
            : { kind: 'text', text: entry.text, tool: null, isError: false, truncated: false },
        ],
      }));
      return {
        status: 'complete',
        reason: null,
        detail: null,
        vendorUrl: null,
        entries: entries.slice(-query.limit),
        nextCursor: null,
        atEnd: true,
        restarted: false,
        dropped: 0,
        redactions: 0,
      };
    }
    if (query instanceof SearchSessionsQuery) return search(query);
    throw new Error(`The eval's workspace answers no ${query?.constructor?.name}.`);
  };

  const queryBus = { execute: async (query: unknown) => answer(query) } as unknown as QueryBus;
  // A write reaches nothing: the stand-ins in front of every write tool are the eval's.
  const commandBus = {
    execute: async () => {
      throw new Error('The eval runs no command.');
    },
  } as unknown as CommandBus;
  const home = spec.hosts.find((host) => host.name === spec.home) ?? null;
  const context: BotToolContext = {
    owner,
    organizationId: 'org-1',
    botId: 'bot-1',
    conversationId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: home?.id ?? null,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    credentialScopes: null,
    // Every card the model raises is answered "requested", as a real one is.
    approvals: { request: async () => ({ status: 'requested', approvalId: 'approval-1' }) },
  } as BotToolContext;
  const areas = [
    new BotHostToolsFactory(queryBus, commandBus),
    new BotPlanToolsFactory(queryBus, commandBus),
    new BotSessionToolsFactory(queryBus, commandBus, {} as never, {} as never),
  ];
  const definitions = areas.flatMap((area) =>
    area.definitions().map((definition) => ({ group: area.group, definition })),
  );
  return {
    definitions,
    context,
    sessions,
    hostById: (id) => spec.hosts.find((host) => host.id === id),
    hostByName: (name) => spec.hosts.find((host) => host.name === name),
    tools: (names) =>
      names.map((name) => {
        const found = definitions.find(({ definition }) => definition.name === name);
        if (!found) throw new Error(`No production tool ${name}.`);
        const bound = found.definition.bind(context);
        return {
          name: bound.name,
          description: bound.description,
          inputSchema: bound.inputSchema,
          run: (input) => bound.run(input, { signal: new AbortController().signal }),
        };
      }),
  };
}
