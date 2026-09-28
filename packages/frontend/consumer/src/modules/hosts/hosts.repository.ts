import { type HostResponseDto, heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { HostEntity, type HostPairing, type HostPairingToken } from './host.entity';
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
    // An absent body is a failed read, not an empty collection — returning `[]`
    // would render "no hosts" over a request that never succeeded.
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

  /**
   * The caller's pairing tokens.
   *
   * Add host polls this to learn whether *its* token was spent, and on which
   * machine. "The host list is non-empty" is a different question — an account
   * that already owns a machine would answer it the moment the step opened.
   */
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

  @MapApiError(HostsErrors.REMOVE_FAILED)
  async remove(id: string): Promise<void> {
    await unwrap(heyApiSdk.unpairHost({ path: { id } }), HostsErrors.REMOVE_FAILED);
  }
}
