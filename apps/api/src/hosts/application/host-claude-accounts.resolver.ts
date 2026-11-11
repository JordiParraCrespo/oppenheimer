import { Inject, Injectable } from '@nestjs/common';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HostMapper } from '../host.mapper';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostClaudeAccountsPort } from './host-claude-accounts.port';

/**
 * Read with no access scope: the caller is the control plane acting for a
 * session it launched, and only hands out ids it then sends one message
 * through. Another person's host is never one: a host is the launcher's own,
 * or the one the session was started on.
 */
@Injectable()
export class HostClaudeAccountsResolver implements HostClaudeAccountsPort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly mapper: HostMapper,
  ) {}

  async signedInLike(hostId: string, ownerUserId: string): Promise<string[]> {
    const found = await this.hosts.findOneByIdForMachine(hostId);
    if (found.isNone() || found.unwrap().isUnpaired) return [];
    const account = this.mapper.toClaudeAccount(found.unwrap().capabilities);
    if (!account) return [];
    const owned = await this.hosts.findOwnedBySystem(ownerUserId);
    const others = owned
      .filter(
        (host) =>
          host.id !== hostId &&
          !host.isUnpaired &&
          this.mapper.toClaudeAccount(host.capabilities) === account,
      )
      .map((host) => host.id);
    return [hostId, ...others];
  }
}
