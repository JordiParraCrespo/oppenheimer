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
   * Writes what the vendor last said, a follow-up or a stop. A blind write:
   * every writer copies the vendor's own state, and `CloudAgentEntity.sync`
   * ignores an answer about an older run, so the last writer is never further
   * from the vendor than one sync.
   */
  save(agent: CloudAgentEntity): Promise<void>;
}
