import { type HostResponseDto, heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import {
  HostEntity,
  type HostFolders,
  type HostPairing,
  type HostPairingToken,
} from './host.entity';
import { HostsErrors } from './hosts.errors';

/** The wire shapes are the generated client's, never mirrored here. */
type HostDto = HostResponseDto;

function toEntity(data: HostDto): HostEntity {
  return new HostEntity(
    data.id,
    data.name,
    data.online,
    data.hostname ?? null,
    data.os ?? null,
    data.arch ?? null,
    data.runnerVersion ?? null,
    data.lastSeenAt ? new Date(data.lastSeenAt) : null,
    new Date(data.createdAt),
    {
      status: data.status,
      runningSessionCount: data.runningSessionCount,
      osName: data.machine?.osName ?? null,
      cpuCount: data.machine?.cpuCount ?? null,
      memoryTotalBytes: data.machine?.memoryTotalBytes ?? null,
      cloudProvider: data.machine?.cloudProvider ?? null,
      countryCode: data.network?.countryCode ?? null,
      city: data.network?.city ?? null,
      asnOrg: data.network?.asnOrg ?? null,
      roundTripMillis: data.vitals?.roundTripMillis ?? null,
    },
  );
}

@injectable()
export class HostsRepository {
  @MapApiError(HostsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<HostEntity[]> {
    const data = await unwrapBody(heyApiSdk.findHosts(), HostsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  /**
   * Mint the registration token Add host pastes; the host appears once its
   * runner dials in.
   *
   * The machine is named before it exists, because the token carries the name
   * the runner will adopt. `replaces` is Add host's "New token": the API revokes
   * that token in the same write, so a refused mint leaves it spendable.
   */
  @MapApiError(HostsErrors.PAIR_FAILED)
  async pair(name: string, replaces?: string): Promise<HostPairing> {
    const data = await unwrapBody(
      heyApiSdk.mintPairingToken({ body: replaces ? { name, replaces } : { name } }),
      HostsErrors.PAIR_FAILED,
    );
    return {
      id: data.id,
      installCommand: data.installCommand,
      agentPrompt: data.agentPrompt,
      installScriptSha256: data.installScriptSha256 ?? null,
      expiresAt: new Date(data.expiresAt),
      redeemedHostId: data.redeemedHostId ?? null,
    };
  }

  @MapApiError(HostsErrors.FETCH_LIST_FAILED)
  async pairings(): Promise<HostPairingToken[]> {
    const data = await unwrapBody(heyApiSdk.findPairingTokens(), HostsErrors.FETCH_LIST_FAILED);
    return data.map((token) => ({
      id: token.id,
      expiresAt: new Date(token.expiresAt),
      redeemedHostId: token.redeemedHostId ?? null,
    }));
  }

  /** Display only: nothing on any machine derives from a host's name. */
  @MapApiError(HostsErrors.RENAME_FAILED)
  async rename(id: string, name: string): Promise<HostEntity> {
    const data = await unwrapBody(
      heyApiSdk.renameHost({ path: { id }, body: { name } }),
      HostsErrors.RENAME_FAILED,
    );
    return toEntity(data);
  }

  /**
   * One directory of the host, through its runner: `path` absolute, or absent
   * for the home directory. The failure keeps the API's code (`SESSIONS_026`
   * to `SESSIONS_031`), which is how the picker tells "no such folder" from
   * "the host is away".
   */
  @MapApiError(HostsErrors.FETCH_FOLDERS_FAILED)
  async findFolders(id: string, path?: string): Promise<HostFolders> {
    const data = await unwrapBody(
      heyApiSdk.findHostFolders({ path: { id }, query: path ? { path } : {} }),
      HostsErrors.FETCH_FOLDERS_FAILED,
    );
    return {
      path: data.path,
      parent: data.parent ?? null,
      home: data.home,
      branch: data.branch ?? null,
      entries: data.entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        branch: entry.branch ?? null,
      })),
      truncated: data.truncated,
      recent: data.recent.map((folder) => ({
        path: folder.path,
        lastUsedAt: new Date(folder.lastUsedAt),
      })),
    };
  }

  /**
   * Ask a connected host's runner for the newest release on its channel. Done
   * is not this answer: the row's runner version changes when the updated
   * runner reconnects. `HOSTS_008` when the host is not connected.
   */
  @MapApiError(HostsErrors.UPDATE_FAILED)
  async updateRunner(id: string): Promise<void> {
    await unwrap(heyApiSdk.updateHostRunner({ path: { id } }), HostsErrors.UPDATE_FAILED);
  }

  /**
   * `wipe` also cleans the machine up: its runner closes every session, removing
   * each worktree without pushing. Only a host online now hears it.
   */
  @MapApiError(HostsErrors.REMOVE_FAILED)
  async remove(id: string, wipe = false): Promise<void> {
    await unwrap(
      heyApiSdk.unpairHost({ path: { id }, query: wipe ? { wipe } : undefined }),
      HostsErrors.REMOVE_FAILED,
    );
  }
}
