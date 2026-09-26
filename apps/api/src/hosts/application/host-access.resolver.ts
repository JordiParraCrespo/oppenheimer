import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HostErrors } from '../domain/hosts.errors';
import { HostMapper } from '../host.mapper';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostAccessPort, UsableHost } from './host-access.port';

/**
 * Answers "may this caller put work on that host" by reading the host through
 * the scoped repository, which is the same predicate a listing uses — so a host
 * a caller cannot see is a host they cannot name either.
 */
@Injectable()
export class HostAccessResolver implements HostAccessPort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly mapper: HostMapper,
  ) {}

  async assertUsable(scope: AccessScope, hostId: string): Promise<UsableHost> {
    const found = await this.hosts.findOneById(scope, hostId);
    // Out of scope, never paired, or unpaired since: all three are reported as
    // missing, because the alternative confirms an id to someone who cannot
    // reach it.
    if (found.isNone() || found.unwrap().isUnpaired) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No usable host with id ${hostId}` });
    }
    return { probedTools: this.mapper.toProbedTools(found.unwrap().capabilities) };
  }
}
