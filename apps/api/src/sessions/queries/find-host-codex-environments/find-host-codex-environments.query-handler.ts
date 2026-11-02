import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type {
  HostCodexEnvironments,
  HostCodexEnvironmentsPort,
} from '../../application/host-codex-environments.port';
import { codexEnvironmentsOrThrow } from '../../application/host-codex-environments-refusal.policy';
import { HOST_CODEX_ENVIRONMENTS } from '../../sessions.di-tokens';
import { FindHostCodexEnvironmentsQuery } from './find-host-codex-environments.query';

/**
 * The composer's Codex environment picker (`product/next-steps/cloud-agents.md`,
 * "Which Codex environment"). The host is checked first with the same check a
 * create makes, so only someone who may start a session on it can see its
 * account's environments; then the runner is asked, live. Nothing is cached:
 * the list is the host's ChatGPT account's, which the control plane never holds.
 */
@QueryHandler(FindHostCodexEnvironmentsQuery)
export class FindHostCodexEnvironmentsQueryHandler
  implements IQueryHandler<FindHostCodexEnvironmentsQuery, HostCodexEnvironments>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_CODEX_ENVIRONMENTS)
    private readonly environments: HostCodexEnvironmentsPort,
  ) {}

  async execute(query: FindHostCodexEnvironmentsQuery): Promise<HostCodexEnvironments> {
    await this.hosts.assertUsable(query.scope, query.hostId);
    const outcome = await this.environments.list(query.hostId, query.repository);
    return codexEnvironmentsOrThrow(outcome, query.hostId);
  }
}
