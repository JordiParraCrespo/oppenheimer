import { Inject, Injectable } from '@nestjs/common';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import { cloudTaskWithFiles } from '../domain/cloud-task.policy';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import { sessionBranchName } from '../domain/session-layout.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { CLOUD_FILES } from '../sessions.di-tokens';
import { WorkSessionMapper } from '../work-session.mapper';
import type { CloudFilesPort } from './cloud-files.port';
import type { SessionLaunchSpec } from './session-dispatch.port';
import { SessionLaunchCredentials } from './session-launch-credentials.resolver';

/**
 * Builds what the host is told to make, from the session and the one name it
 * cannot read off it: the workspace's slug, asked of `organizations/` through its
 * port. One place, so every command that dispatches a launch — create, restart,
 * add a checkout, the hello reconciliation — names the same directories. No
 * project name travels (see `sessionCreateSchema`), and no account: the runner
 * learnt that when it was paired (24 §2).
 *
 * A cloud session's files are not sent as `images`: its host only starts it,
 * so the task carries a fresh link to each instead, minted on every launch so
 * a create sent again after a reconnect never names an expired one.
 */
@Injectable()
export class SessionLaunchSpecFactory {
  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    private readonly credentials: SessionLaunchCredentials,
    @Inject(CLOUD_FILES)
    private readonly cloudFiles: CloudFilesPort,
  ) {}

  async build(
    session: WorkSessionEntity,
    extra: { prompt?: string; images?: SessionLaunchFile[] } = {},
  ): Promise<SessionLaunchSpec> {
    const organizationSlug = await this.workspaces.slugOf(session.organizationId);
    // The session row was written in this workspace; a missing slug is a broken
    // invariant, not a request error.
    if (!organizationSlug) throw new Error(`workspace ${session.organizationId} has no slug`);
    const task = await this.taskFor(session, extra);
    return {
      organizationSlug,
      workspaceId: session.organizationId,
      ...(session.place !== 'folder'
        ? { branch: session.branch ?? sessionBranchName(session.slug) }
        : {}),
      ...(task.prompt ? { prompt: task.prompt } : {}),
      ...(task.images?.length ? { images: task.images } : {}),
      ...(await this.credentials.for(session)),
    };
  }

  private async taskFor(
    session: WorkSessionEntity,
    extra: { prompt?: string; images?: SessionLaunchFile[] },
  ): Promise<{ prompt?: string; images?: SessionLaunchFile[] }> {
    if (session.place !== 'cloud' || !extra.prompt || !extra.images?.length) return extra;
    const owner = { organizationId: session.organizationId, sessionId: session.id };
    const urls = await Promise.all(extra.images.map((file) => this.cloudFiles.link(owner, file)));
    return {
      prompt: cloudTaskWithFiles(
        extra.prompt,
        WorkSessionMapper.toCloudTaskFiles(extra.images, urls),
      ),
    };
  }
}
