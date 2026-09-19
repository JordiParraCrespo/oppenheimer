import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import { HostEntity } from '../../domain/host.entity';
import { HostErrors } from '../../domain/hosts.errors';
import { hashPairingTokenSecret } from '../../domain/pairing-token-secret.factory';
import { HostMapper } from '../../host.mapper';
import { HOST_PAIRING_TOKEN_REPOSITORY, HOST_REPOSITORY } from '../../hosts.di-tokens';
import { keyFingerprint } from '../../infrastructure/host-assertion.util';
import { RunnerReleaseConfig } from '../../infrastructure/runner-release.config';
import { RegisterHostCommand } from './register-host.command';

/** Every reason at once, because the endpoint will not say which applied. */
const REJECTION_DETAIL =
  'The token is expired, already used, or revoked; mint a new one in Settings → Add host.';

/** What the machine is told, and what it pins from then on. */
export interface RegisterHostResult {
  hostId: string;
  fingerprint: string;
  channel: string;
  releaseBaseUrl: string;
}

/**
 * Turns a machine holding a registration token into a host.
 *
 * The redemption and the host's creation are one transaction, so a lost response
 * is not a lost host: the runner retries with the same key, the burn claims
 * nothing the second time, and the fingerprint it presents identifies the host
 * that already exists.
 */
@CommandHandler(RegisterHostCommand)
export class RegisterHostCommandHandler
  implements ICommandHandler<RegisterHostCommand, RegisterHostResult>
{
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
    private readonly mapper: HostMapper,
    private readonly release: RunnerReleaseConfig,
  ) {}

  async execute(command: RegisterHostCommand): Promise<RegisterHostResult> {
    const controlPlaneFingerprint = this.release.controlPlaneFingerprint;
    // Without a key of its own there is nothing for the runner to pin, and a
    // host that cannot pin the control plane would talk to anyone.
    if (!this.release.isConfigured || !controlPlaneFingerprint) {
      const detail = 'This deployment has no runner release or signing key configured.';
      throw new AppError(HostErrors.NOT_CONFIGURED, { detail });
    }

    const fingerprint = keyFingerprint(command.publicKey);
    if (!fingerprint) throw new ArgumentInvalidException('publicKey must be a 32-byte Ed25519 key');

    const tokenHash = hashPairingTokenSecret(command.token);
    const found = await this.tokens.findOneByHash(tokenHash);
    if (found.isNone()) throw this.rejected();
    const token = found.unwrap();

    const host = HostEntity.register(
      this.mapper.toRegisterProps({
        ownerUserId: token.createdByUserId,
        // The token named the machine before it existed; the runner's own name
        // is the fallback for a token that named nothing.
        name: token.intendedName || command.name,
        publicKey: command.publicKey,
        publicKeyFingerprint: fingerprint,
        facts: command.facts,
        pairingTokenId: token.id,
      }),
    );

    const registered = await this.hosts.redeemAndRegister({
      tokenHash,
      host,
      redeemedFromIp: command.redeemedFromIp,
      now: new Date(),
    });

    const hostId = registered.isSome()
      ? registered.unwrap().id
      : await this.hostFromRetry(tokenHash, fingerprint);

    return {
      hostId,
      fingerprint: controlPlaneFingerprint,
      channel: this.release.channel,
      releaseBaseUrl: this.release.releaseBaseUrl ?? '',
    };
  }

  /**
   * The burn claimed nothing — used, expired, revoked or never real, one answer
   * for all four. The exception is a machine retrying after a response it never
   * received: it proves that by presenting the key the spent token already
   * paired, and gets back the host it created the first time.
   */
  private async hostFromRetry(tokenHash: string, fingerprint: string): Promise<string> {
    const found = await this.tokens.findOneByHash(tokenHash);
    const redeemedHostId = found.isSome() ? found.unwrap().redeemedHostId : null;
    if (!redeemedHostId) throw this.rejected();

    const host = await this.hosts.findOneByIdForMachine(redeemedHostId);
    if (host.isNone() || !host.unwrap().hasFingerprint(fingerprint)) throw this.rejected();

    return host.unwrap().id;
  }

  private rejected(): AppError {
    return new AppError(HostErrors.PAIRING_TOKEN_REJECTED, { detail: REJECTION_DETAIL });
  }
}
