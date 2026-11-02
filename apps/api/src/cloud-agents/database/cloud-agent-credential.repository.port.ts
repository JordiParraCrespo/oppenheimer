import type { CloudAgentProviderId } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { CloudAgentCredentialEntity } from '../domain/cloud-agent-credential.entity';

/**
 * A person's vendor keys: every read through a scope is of the caller's own,
 * in their workspace. A person holds one per vendor, so a list is bounded by
 * `CLOUD_AGENT_PROVIDERS`.
 */
export interface CloudAgentCredentialRepositoryPort {
  findAllOwn(scope: AccessScope): Promise<CloudAgentCredentialEntity[]>;
  /** A provider's read, where only the workspace and the person are known. */
  findFor(
    organizationId: string,
    userId: string,
    provider: CloudAgentProviderId,
  ): Promise<Option<CloudAgentCredentialEntity>>;
  /** Stores the key, replacing the person's key for that vendor. */
  put(credential: CloudAgentCredentialEntity): Promise<void>;
  /** Forgets the caller's key for the vendor; false when there was none. */
  deleteOwn(scope: AccessScope, provider: CloudAgentProviderId): Promise<boolean>;
}
