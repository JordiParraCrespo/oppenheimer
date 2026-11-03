import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireOnHost, SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionSharedFilesPort } from '../../application/session-shared-files.port';
import { SESSION_SHARED_FILES } from '../../sessions.di-tokens';
import {
  FindSessionSharedPreviewQuery,
  type SessionSharedPreviewRead,
} from './find-session-shared-preview.query';

/**
 * A shared file's preview (`product/next-steps/agent-tools.md` §7). The
 * session, in the caller's scope, names the file (the last twenty it keeps);
 * one it does not name, or one the runner kept no preview of, is never asked
 * of the host. The bytes live there, so the host is asked live, and a host
 * that refuses (the file was cleaned up) answers `gone` with its code.
 */
@QueryHandler(FindSessionSharedPreviewQuery)
export class FindSessionSharedPreviewQueryHandler
  implements IQueryHandler<FindSessionSharedPreviewQuery, SessionSharedPreviewRead>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_SHARED_FILES)
    private readonly shared: SessionSharedFilesPort,
  ) {}

  async execute(query: FindSessionSharedPreviewQuery): Promise<SessionSharedPreviewRead> {
    const session = requireOnHost(await this.loader.find(query.scope, query.sessionId));
    const file = session.sharedFiles.find((candidate) => candidate.id === query.fileId);
    if (!file) return { kind: 'unknown_file' };
    if (!file.hasPreview) return { kind: 'no_preview', file };
    const outcome = await this.shared.preview(session.hostId, session.id, file.id);
    switch (outcome.kind) {
      case 'preview':
        return { kind: 'preview', file, mediaType: outcome.mediaType, data: outcome.data };
      case 'host_offline':
      case 'not_supported':
      case 'timed_out':
        return { kind: outcome.kind, file };
      case 'failed':
        return { kind: 'gone', file, code: outcome.code };
    }
  }
}
