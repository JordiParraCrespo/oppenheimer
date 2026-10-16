import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { HostFolderListing, HostFoldersPort } from '../../application/host-folders.port';
import { listedOrThrow } from '../../application/host-folders-refusal.policy';
import type {
  RecentFolder,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { HOST_FOLDERS, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { FindHostFoldersQuery } from './find-host-folders.query';

/** How many recent folders the picker offers. */
export const RECENT_FOLDERS_LIMIT = 8;

export interface HostFoldersRead {
  listing: HostFolderListing;
  recent: RecentFolder[];
}

/**
 * The folder picker's read (`product/versions/mvp/24-session-places.md` §4).
 *
 * The host is checked first with the same check a create makes, so only someone
 * who may start a session on it can see its directory names, and a host they
 * cannot use is the same not-found. Then the runner is asked, live — nothing is
 * cached — while the recent folders are read from the rows.
 */
@QueryHandler(FindHostFoldersQuery)
export class FindHostFoldersQueryHandler
  implements IQueryHandler<FindHostFoldersQuery, HostFoldersRead>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_FOLDERS)
    private readonly folders: HostFoldersPort,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: FindHostFoldersQuery): Promise<HostFoldersRead> {
    const { scope, hostId, path } = query;
    await this.hosts.assertUsable(scope, hostId);
    const [outcome, recent] = await Promise.all([
      this.folders.list(hostId, path),
      this.sessions.findRecentFolders(scope, hostId, query.userId, RECENT_FOLDERS_LIMIT),
    ]);
    return { listing: listedOrThrow(outcome, hostId, path), recent };
  }
}
