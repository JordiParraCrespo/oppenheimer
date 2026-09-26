import { Inject, Injectable } from '@nestjs/common';
import type { HostUsagePort } from '../../hosts/application/host-usage.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * This module's answer to "what is running on this host", for the hosts list's
 * "Running · 2 sessions" and the remove dialog's cost line.
 *
 * Contributed through `HostsModule.contributeUsage([...])` rather than exported,
 * for the reason `SessionProjectUsage` is: a session needs the host it runs on,
 * so `hosts/` cannot import this module to inject it.
 */
@Injectable()
export class SessionHostUsage implements HostUsagePort {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  countRunningSessions(hostIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    return this.sessions.countRunningByHost(hostIds);
  }
}
