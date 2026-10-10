import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HostErrors } from '../domain/hosts.errors';
import { HostMapper } from '../host.mapper';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostAccessPort, UsableHost } from './host-access.port';

/**
 * The scoped read is the same predicate a listing uses, so a host a caller
 * cannot see is a host they cannot name either.
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
    if (found.isNone() || found.unwrap().isUnpaired) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No usable host with id ${hostId}` });
    }
    const host = found.unwrap();
    return {
      probedTools: this.mapper.toProbedTools(host.capabilities),
      sessionLimit: host.sessionLimit,
    };
  }
}
