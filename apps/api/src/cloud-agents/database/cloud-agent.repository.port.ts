import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { CloudAgentEntity } from '../domain/cloud-agent.entity';

/** The most agents the list shows: the caller's newest. */
export const CLOUD_AGENT_LIST_LIMIT = 50;

/**
 * Cloud agents are the caller's own: every read is of the agents they
 * launched, in their workspace. Someone else's is not found.
 */
export interface CloudAgentRepositoryPort {
  /** The caller's newest agents, newest first, at most {@link CLOUD_AGENT_LIST_LIMIT}. */
  findOwn(scope: AccessScope): Promise<CloudAgentEntity[]>;
  findOwnById(scope: AccessScope, id: string): Promise<Option<CloudAgentEntity>>;
  insert(agent: CloudAgentEntity): Promise<void>;
  /**
   * Writes what the vendor last said, a follow-up or a stop, only if the row
   * is still on `runIdAtLoad`, the latest run it held when it was read.
   * False means another writer moved it to a newer run first (a sync that
   * left before a follow-up landed), and nothing was written.
   */
  saveIfRun(agent: CloudAgentEntity, runIdAtLoad: string): Promise<boolean>;
}
