import type { FsFoundMessage, FsListingMessage } from '@oppenheimer/shared/protocol';

/** One directory on a host as its runner listed it (`fs.listing` without its envelope). */
export type HostFolderListing = Omit<FsListingMessage, 'type' | 'commandId'>;

/** The folders a host's runner found by name (`fs.found` without its envelope). */
export type HostFolderSearch = Omit<FsFoundMessage, 'type' | 'commandId'>;

/**
 * What asking a host for a directory came back with: the listing, the reason
 * nothing was asked (no link, or a runner that does not list), no answer in
 * time, or the runner's refusal with its catalog code (`FS_001` not found,
 * `FS_002` not a directory, `FS_003` not readable).
 */
export type HostFoldersOutcome<T = HostFolderListing> =
  | { kind: 'listed'; listing: T }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so the folder picker
 * can list a host's directories (`product/versions/mvp/24-session-places.md`
 * §4). Unlike `SessionDispatchPort` it waits for the runner's answer: nothing
 * is cached, and nothing is written.
 */
export interface HostFoldersPort {
  /** List `path` on the host, or its home directory when absent. */
  list(hostId: string, path?: string): Promise<HostFoldersOutcome>;
  /**
   * Find the folders under the host's home whose name holds `query`: the
   * runner's bounded walk, refused as a listing of home would be.
   */
  find(hostId: string, query: string): Promise<HostFoldersOutcome<HostFolderSearch>>;
}
