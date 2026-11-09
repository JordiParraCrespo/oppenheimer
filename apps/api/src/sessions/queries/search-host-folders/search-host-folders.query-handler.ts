import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { HostFolderSearch, HostFoldersPort } from '../../application/host-folders.port';
import { listedOrThrow } from '../../application/host-folders-refusal.policy';
import { HOST_FOLDERS } from '../../sessions.di-tokens';
import { SearchHostFoldersQuery } from './search-host-folders.query';

/**
 * The folder picker's search (`product/versions/mvp/24-session-places.md` §4):
 * the same host check a listing makes, then the runner's walk, live. Its
 * refusals are a listing of home's.
 */
@QueryHandler(SearchHostFoldersQuery)
export class SearchHostFoldersQueryHandler
  implements IQueryHandler<SearchHostFoldersQuery, HostFolderSearch>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_FOLDERS)
    private readonly folders: HostFoldersPort,
  ) {}

  async execute(query: SearchHostFoldersQuery): Promise<HostFolderSearch> {
    await this.hosts.assertUsable(query.scope, query.hostId);
    const outcome = await this.folders.find(query.hostId, query.text);
    return listedOrThrow(outcome, query.hostId, undefined);
  }
}
