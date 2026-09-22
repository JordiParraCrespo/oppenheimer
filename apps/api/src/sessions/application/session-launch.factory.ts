import { Inject, Injectable } from '@nestjs/common';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import { sessionBranchName } from '../domain/session-layout.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { SessionLaunchSpec } from './session-dispatch.port';

/**
 * Builds what the host is told to make, from the session and the two names it
 * cannot read off it: the project's slug (the handler already loaded the
 * project) and the workspace's, asked of `organizations/` through its port.
 * One place, so every command that dispatches a launch — create, restart, add a
 * checkout, the hello reconciliation — names the same directories.
 */
@Injectable()
export class SessionLaunchSpecFactory {
  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
  ) {}

  async build(
    session: WorkSessionEntity,
    projectSlug: string,
    extra: { branch?: string; prompt?: string } = {},
  ): Promise<SessionLaunchSpec> {
    const organizationSlug = await this.workspaces.slugOf(session.organizationId);
    // The session row was written in this workspace; a missing slug is a broken
    // invariant, not a request error.
    if (!organizationSlug) throw new Error(`workspace ${session.organizationId} has no slug`);
    return {
      organizationSlug,
      projectSlug,
      branch: extra.branch ?? sessionBranchName(projectSlug, session.slug),
      ...(extra.prompt ? { prompt: extra.prompt } : {}),
    };
  }
}
