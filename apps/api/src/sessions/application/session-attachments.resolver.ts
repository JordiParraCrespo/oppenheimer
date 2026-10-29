import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { type CreateSessionDto, fitsPromptBound } from '@oppenheimer/shared';
import { SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import type { ParkedFilePort } from '../../links/application/parked-file.port';
import { LINK_REGISTRY, PARKED_FILES } from '../../links/links.di-tokens';
import { cloudTaskWithFiles } from '../domain/cloud-task.policy';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import { SessionErrors } from '../domain/sessions.errors';
import { CLOUD_FILES } from '../sessions.di-tokens';
import { WorkSessionMapper } from '../work-session.mapper';
import type { CloudFilesPort } from './cloud-files.port';
import { requireFileCapableHost } from './require-file-capable-host.policy';

/**
 * Turns a create's `attachmentIds` into the files its host will pull, or refuses
 * the create.
 *
 * It runs after the session's id is minted and **before** its row is written: a task
 * that talks about a screenshot or a PDF must not start without it. The result is recorded on
 * the log's `prompt.first`, so a create that reaches its host late, or again after a
 * reconnect, still names images that are waiting. Uploads stay staged until they
 * expire, so a create that fails after this can be sent again as it was.
 *
 * A cloud session's files never go to its host, which only starts it: they are
 * kept in storage under the session and its task links them
 * (`CloudFilesPort`), so no runner capability is asked for. The task and its
 * links are measured first, since together they must fit a first task's bound.
 */
@Injectable()
export class SessionAttachmentsResolver {
  constructor(
    @Inject(PARKED_FILES)
    private readonly files: ParkedFilePort,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(CLOUD_FILES)
    private readonly cloudFiles: CloudFilesPort,
  ) {}

  async claim(
    scope: AccessScope,
    userId: string,
    sessionId: string,
    input: Pick<CreateSessionDto, 'hostId' | 'attachmentIds' | 'cloud' | 'prompt'>,
  ): Promise<SessionLaunchFile[]> {
    const { hostId, attachmentIds: ids } = input;
    if (!ids?.length || !scope.organizationId) return [];
    const owner = { organizationId: scope.organizationId, userId };
    if (input.cloud) return this.keepForCloud(owner, sessionId, ids, input.prompt ?? '');
    // The types are not known until the claim; first ask what any file needs.
    requireFileCapableHost(this.links, hostId, SESSION_IMAGE_MEDIA_TYPES);
    const claimed = await this.files.claim(ids, owner, { hostId, sessionId });
    if (!claimed) {
      throw new AppError(SessionErrors.ATTACHMENT_NOT_FOUND, {
        detail: 'An attached file expired or was never uploaded here; attach it again.',
      });
    }
    // The types are known once claimed. A refusal here leaves the staged
    // copies, so the same create can be sent again once the runner is updated;
    // the claimed copies expire unread.
    requireFileCapableHost(
      this.links,
      hostId,
      claimed.map((image) => image.mediaType),
    );
    return claimed;
  }

  private async keepForCloud(
    owner: { organizationId: string; userId: string },
    sessionId: string,
    ids: readonly string[],
    prompt: string,
  ): Promise<SessionLaunchFile[]> {
    const staged = await this.files.staged(ids, owner);
    if (!staged) {
      throw new AppError(SessionErrors.ATTACHMENT_NOT_FOUND, {
        detail: 'An attached file expired or was never uploaded here; attach it again.',
      });
    }
    const longest = staged.map(() => 'x'.repeat(this.cloudFiles.linkLength));
    const task = cloudTaskWithFiles(prompt, WorkSessionMapper.toCloudTaskFiles(staged, longest));
    if (!fitsPromptBound(task)) {
      throw new AppError(SessionErrors.CLOUD_TASK_TOO_LONG, {
        detail: `Each file adds a download link to the task, and with ${staged.length} the task passes 2 KB. Shorten the task or attach fewer files.`,
      });
    }
    return this.cloudFiles.keep({ organizationId: owner.organizationId, sessionId }, staged);
  }
}
