'use client';

/**
 * Query key factory for the `hosts` feature, from the most generic (`all`) to
 * the most specific, one function per level so any subtree can be named:
 *
 * ```
 * ['hosts']                                   all
 * ['hosts', 'list']                           lists() → list()
 * ['hosts', 'pairing']                        pairings()
 * ['hosts', 'pairing', 'list']                pairingLists() → pairingList()   the tokens Add host polls
 * ['hosts', 'pairing', 'detail']              pairingDetails()
 * ['hosts', 'pairing', 'detail', name]        pairingDetail(name)              the token Add host shows
 * ['hosts', 'detail']                         details()
 * ['hosts', 'detail', id]                     detail(id)
 * ['hosts', 'detail', id, 'folders']          folderLists(id)
 * ['hosts', 'detail', id, 'folders', path]    folders(id, path)                one directory; null is home
 * ```
 *
 * A pairing detail's `queryFn` mints: refetching it issues a new token under
 * the command on screen. So refresh the poll with `pairingLists()`, and never
 * invalidate `pairings()` or `pairingDetails()` while Add host is open.
 */
export const hostsKeys = {
  all: ['hosts'] as const,
  lists: () => [...hostsKeys.all, 'list'] as const,
  list: () => [...hostsKeys.lists()] as const,
  pairings: () => [...hostsKeys.all, 'pairing'] as const,
  pairingLists: () => [...hostsKeys.pairings(), 'list'] as const,
  pairingList: () => [...hostsKeys.pairingLists()] as const,
  pairingDetails: () => [...hostsKeys.pairings(), 'detail'] as const,
  pairingDetail: (name: string) => [...hostsKeys.pairingDetails(), name] as const,
  details: () => [...hostsKeys.all, 'detail'] as const,
  detail: (id: string) => [...hostsKeys.details(), id] as const,
  folderLists: (id: string) => [...hostsKeys.detail(id), 'folders'] as const,
  folders: (id: string, path: string | null) => [...hostsKeys.folderLists(id), path] as const,
};
