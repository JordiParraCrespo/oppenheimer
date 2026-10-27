import type { CloudAgentRunState } from '../domain/cloud-agent.entity';

/** A Cursor key, and what its calls count against (`CursorCloudAgentsGateway`). */
export interface CursorAccess {
  apiKey: string;
  /** `user:<cursor user id>`, or a digest of the key for one that names no person. */
  bucket: string;
}

/** Who a key is, as `GET /v1/me` says. */
export interface CursorKeyOwner {
  keyName: string;
  userId: string | null;
  email: string | null;
}

/** What a launch asks Cursor for. */
export interface CursorLaunch {
  /** Our id, sent as Cursor's agent id (`bc-<id>`) so a retried launch cannot start a second agent. */
  agentId: string;
  prompt: string;
  repositoryUrl: string;
  startingRef: string | null;
  model: string | null;
  autoCreatePr: boolean;
}

/** An agent and its latest run, in our words. */
export interface CursorAgentRun extends CloudAgentRunState {
  agentId: string;
  name: string;
  url: string | null;
}

/** A model Cursor offers; its own default ("Auto") is not listed: a launch names no model for it. */
export interface CursorModel {
  id: string;
  label: string;
}

/**
 * Cursor's Cloud Agents API (v1). Every call may throw `CLOUD_AGENTS_007` for
 * a rate limit, `CLOUD_AGENTS_005` for a key Cursor refuses, `CLOUD_AGENTS_010`
 * for a request it refuses as asked, `CLOUD_AGENTS_008`/`009` for an agent
 * busy or a run already ended, and `CLOUD_AGENTS_006` for anything else.
 */
export interface CursorCloudAgentsPort {
  me(apiKey: string): Promise<CursorKeyOwner>;
  launch(access: CursorAccess, launch: CursorLaunch): Promise<CursorAgentRun>;
  /** Starts a new run on the agent with `prompt`; answers its id. */
  followUp(access: CursorAccess, agentId: string, prompt: string): Promise<string>;
  cancel(access: CursorAccess, agentId: string, runId: string): Promise<void>;
  read(access: CursorAccess, agentId: string, runId: string): Promise<CloudAgentRunState>;
  /** Cached per account for an hour: the list changes with Cursor's releases. */
  models(access: CursorAccess): Promise<CursorModel[]>;
  /** Cached per account for ten minutes: Cursor allows one call a minute. */
  repositories(access: CursorAccess): Promise<string[]>;
}
