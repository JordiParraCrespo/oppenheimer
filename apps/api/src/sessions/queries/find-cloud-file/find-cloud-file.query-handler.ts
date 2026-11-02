import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { CloudFile, CloudFilesPort } from '../../application/cloud-files.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { CLOUD_FILES } from '../../sessions.di-tokens';
import { FindCloudFileQuery } from './find-cloud-file.query';

/**
 * A cloud session's file, for the cloud's agent that downloads it. The token
 * is the whole of the authorization: it is unguessable, minted for one file
 * of one session, and lives a day. An expired link and one never minted are
 * one answer, `SESSIONS_041`.
 */
@QueryHandler(FindCloudFileQuery)
export class FindCloudFileQueryHandler implements IQueryHandler<FindCloudFileQuery, CloudFile> {
  constructor(
    @Inject(CLOUD_FILES)
    private readonly files: CloudFilesPort,
  ) {}

  async execute(query: FindCloudFileQuery): Promise<CloudFile> {
    const file = await this.files.open(query.token);
    if (!file) throw new AppError(SessionErrors.CLOUD_FILE_NOT_FOUND);
    return file;
  }
}
