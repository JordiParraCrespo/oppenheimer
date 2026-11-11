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
    // The inventory, not the row: a host signed in after it was paired says
    // so only on its heartbeats.
    const hosts = await this.hosts.findPairedWithInventoryForMachine(hostId, ownerUserId);
    const started = hosts.find((host) => host.id === hostId);
    const account = started ? this.mapper.toClaudeAccount(started.capabilities) : null;
    if (!account) return [];
    const others = hosts
      .filter(
        (host) => host.id !== hostId && this.mapper.toClaudeAccount(host.capabilities) === account,
      )
      .map((host) => host.id);
    return [hostId, ...others];
  }
}
