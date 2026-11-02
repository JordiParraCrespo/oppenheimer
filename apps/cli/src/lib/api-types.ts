import type { CodingAgentId } from '@oppenheimer/shared/agents';
import type { PermissionGroup, Scope } from '@oppenheimer/shared/scopes';

/**
 * Response shapes the CLI consumes, narrowed to the fields it reads. They
 * mirror the API's DTOs (`apps/api/openapi.json`); the CLI is written against
 * the HTTP contract rather than a build of the API, so it runs against any
 * deployment of the same version.
 */

export interface CurrentCredential {
  kind: 'session' | 'api-token' | 'oauth';
  userId: string;
  email: string;
  grantedScopes: Scope[] | null;
  effectiveScopes: Scope[];
  organizationIds: string[] | null;
  expiresAt: string | null;
}

export interface PermissionCatalog {
  groups: PermissionGroup[];
  grantable: Scope[];
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  organizationIds: string[] | null;
  ipAllowlist: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiToken extends ApiToken {
  /** Shown once, at creation. */
  token: string;
}

export interface Host {
  id: string;
  name: string;
  hostname?: string | null;
  os?: string | null;
  online: boolean;
  status: string;
  runningSessionCount: number;
  lastSeenAt?: string | null;
}

export interface ProjectRepository {
  installationId: string;
  /** GitHub's id, sent as a string because it can outgrow a JSON number one day. */
  githubRepoId: string;
  repositoryFullName: string;
  baseBranch: string;
  isDefault: boolean;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  repositories: ProjectRepository[];
  defaultHostId?: string | null;
  defaultAgent?: CodingAgentId | null;
  isUnassigned: boolean;
}

export interface Installation {
  id: string;
  accountLogin: string;
  suspendedAt?: string | null;
}

export interface Repository {
  githubRepoId: number;
  fullName: string;
  defaultBranch: string;
}

/** What a session's dot says: the derived group, computed on read. */
export type SessionState =
  | 'working'
  | 'waiting-on-you'
  | 'ready-for-review'
  | 'landing'
  | 'idle'
  | 'resolved';

/** What the agent waits on: a question it asked, or a permission dialog. */
export type SessionDecision =
  | { kind: 'question'; id: string; questions: { question?: string; header?: string }[] }
  | { kind: 'permission'; id: string; title: string; detail: string | null };

export interface SessionAgentReport {
  state: 'idle' | 'working' | 'done' | 'blocked' | 'error';
  message: string | null;
  title: string | null;
}

export interface Session {
  id: string;
  projectId: string;
  hostId: string | null;
  name: string;
  slug: string;
  agent: string;
  place: 'worktree' | 'folder' | 'cloud';
  state: SessionState;
  lifecycle: 'starting' | 'open' | 'failed' | 'resolved';
  lastEventAt?: string | null;
  checkouts: { repositoryFullName: string; branch: string; baseBranch: string }[];
  hints: string[];
  decision: SessionDecision | null;
  agentReport: SessionAgentReport | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /sessions/{id}/events`: the append-only log, by `seq`. */
export interface SessionLogPage {
  data: { seq: number; kind: string; payload: Record<string, unknown> }[];
  nextSeq: number | null;
}

/** `POST /sessions/{id}/prompt`: where the prompt landed in the log, and the session. */
export interface SentPrompt {
  seq: number;
  session: Session;
}

export interface SessionPage {
  data: Session[];
  meta: { total?: number; page?: number; limit: number; nextCursor: string | null };
}

export interface Automation {
  id: string;
  projectId: string;
  name: string;
  status: 'active' | 'paused' | 'running';
  nextRunAt?: string | null;
  runCount: number;
  createdAt: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  homeHostId: string | null;
  provider: string;
  model: string | null;
  lastActivityAt: string;
}

export interface BotTurn {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  error: string | null;
}

export interface BotMessage {
  id: string;
  turnId: string | null;
  role: 'user' | 'assistant' | 'activity' | 'event';
  content: string;
  createdAt: string;
}

/** A tool call the bot wants to make that waits on a person's decision. */
export interface BotApproval {
  id: string;
  turnId: string;
  tool: string;
  summary: string;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'failed';
}

export interface BotConversation {
  messages: BotMessage[];
  turns: BotTurn[];
}

export type TaskStatus = 'later' | 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  projectId: string;
  status: TaskStatus;
  title: string;
  notes: string;
  dueDate?: string | null;
  version: number;
  sessions: unknown[];
  createdAt: string;
}
