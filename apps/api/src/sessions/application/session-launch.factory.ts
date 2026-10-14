import { Inject, Injectable } from '@nestjs/common';
import type { HostOwnerPort } from '../../hosts/application/host-owner.port';
import { HOST_OWNER } from '../../hosts/hosts.di-tokens';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import { sessionBranchName } from '../domain/session-layout.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { SessionLaunchSpec } from './session-dispatch.port';

/**
 * Builds what the host is told to make, from the session and the two names it
 * cannot read off it: the workspace's slug, asked of `organizations/`, and the
 * account the host is paired with, asked of `hosts/`. One place, so every
 * command that dispatches a launch — create, restart, add a checkout, the hello
 * reconciliation — names the same directories. No project name travels (see
 * `sessionCreateSchema`).
 */
@Injectable()
export class SessionLaunchSpecFactory {
  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    @Inject(HOST_OWNER)
    private readonly hosts: HostOwnerPort,
  ) {}

  async build(
    session: WorkSessionEntity,
    extra: { prompt?: string; images?: SessionLaunchFile[] } = {},
  ): Promise<SessionLaunchSpec> {
    const [organizationSlug, accountId] = await Promise.all([
      this.workspaces.slugOf(session.organizationId),
      this.hosts.ownerOf(session.hostId),
    ]);
    // The session row was written in this workspace, on this host, and both are
    // foreign keys: either missing is a broken invariant, not a request error.
    if (!organizationSlug) throw new Error(`workspace ${session.organizationId} has no slug`);
    if (!accountId) throw new Error(`host ${session.hostId} has no owner`);
    return {
      organizationSlug,
      accountId,
      workspaceId: session.organizationId,
      ...(session.place === 'worktree'
        ? { branch: session.branch ?? sessionBranchName(session.slug) }
        : {}),
      ...(extra.prompt ? { prompt: extra.prompt } : {}),
      ...(extra.images?.length ? { images: extra.images } : {}),
    };
  }
}
