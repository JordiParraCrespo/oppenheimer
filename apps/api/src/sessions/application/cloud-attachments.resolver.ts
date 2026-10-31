import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { StagedFileReaderPort } from '../../links/application/staged-file-reader.port';
import { STAGED_FILE_READER } from '../../links/links.di-tokens';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import { SessionErrors } from '../domain/sessions.errors';
import { CLOUD_FILES } from '../sessions.di-tokens';
import type { CloudFilesPort } from './cloud-files.port';
import { CloudTaskFactory } from './cloud-task.factory';

/**
 * Turns a cloud session's `attachmentIds` into files kept for its agent, or
 * refuses the create. The cloud counterpart of `SessionAttachmentsResolver`:
 * the host only starts a cloud session, so nothing is parked for it and no
 * runner capability is asked for; the files are kept in storage under the
 * session and its task links them (`CloudFilesPort`).
 *
 * It runs, as the host's does, after the session's id is minted and before
 * its row is written, and its result is recorded on `prompt.first`. The task
 * and its links are measured first, since together they must fit a first
 * task's bound, so a refused create keeps nothing.
 */
@Injectable()
export class CloudAttachmentsResolver {
  constructor(
    @Inject(STAGED_FILE_READER)
    private readonly staged: StagedFileReaderPort,
    @Inject(CLOUD_FILES)
    private readonly files: CloudFilesPort,
    private readonly tasks: CloudTaskFactory,
  ) {}

  async claim(
    scope: AccessScope,
    userId: string,
    sessionId: string,
    { attachmentIds: ids, prompt }: Pick<CreateSessionDto, 'attachmentIds' | 'prompt'>,
  ): Promise<SessionLaunchFile[]> {
    if (!ids?.length || !scope.organizationId) return [];
    const files = await this.staged.readStaged(ids, {
      organizationId: scope.organizationId,
      userId,
    });
    if (!files) {
      throw new AppError(SessionErrors.ATTACHMENT_NOT_FOUND, {
        detail: 'An attached file expired or was never uploaded here; attach it again.',
      });
    }
    if (!this.tasks.fits(prompt ?? '', files)) {
      throw new AppError(SessionErrors.CLOUD_TASK_TOO_LONG, {
        detail: `Each file adds a download link to the task, and with ${files.length} the task passes 2 KB. Shorten the task or attach fewer files.`,
      });
    }
    return this.files.keep({ organizationId: scope.organizationId, sessionId }, files);
  }
}
