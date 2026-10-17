import { AppError } from '@oppenheimer/backend-core';
import { SessionErrors } from '../domain/sessions.errors';
import type { HostFolderListing, HostFoldersOutcome } from './host-folders.port';

/**
 * The listing a host answered with, or the problem for why there is none.
 *
 * Total over the runner's codes: the three `fs.list` names (`FS_001` not found,
 * `FS_002` not a directory, `FS_003` not readable) map one to one, and any other
 * refusal reads as not readable, with the runner's own code kept as
 * `upstreamCode`, so a code a later runner adds is still a documented problem.
 */
export function listedOrThrow(
  outcome: HostFoldersOutcome,
  hostId: string,
  path: string | undefined,
): HostFolderListing {
  const where = path ?? 'the home directory';
  switch (outcome.kind) {
    case 'listed':
      return outcome.listing;
    case 'host_offline':
      throw new AppError(SessionErrors.FOLDERS_HOST_OFFLINE, {
        detail: `Host ${hostId} holds no link right now`,
      });
    case 'not_supported':
      throw new AppError(SessionErrors.FOLDERS_UNSUPPORTED_BY_RUNNER, {
        detail: `Update the runner on host ${hostId} to pick a folder on it`,
      });
    case 'timed_out':
      throw new AppError(SessionErrors.FOLDERS_TIMED_OUT, {
        detail: `Host ${hostId} did not list ${where} in time`,
      });
    case 'failed': {
      const definition =
        outcome.code === 'FS_001'
          ? SessionErrors.FOLDER_NOT_FOUND
          : outcome.code === 'FS_002'
            ? SessionErrors.NOT_A_FOLDER
            : SessionErrors.FOLDER_NOT_READABLE;
      throw new AppError(definition, {
        detail: outcome.detail ?? `The host refused to list ${where}`,
        extensions: { upstreamCode: outcome.code },
      });
    }
  }
}
