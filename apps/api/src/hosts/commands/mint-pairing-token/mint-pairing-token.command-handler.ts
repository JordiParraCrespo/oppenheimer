import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { HostErrors } from '../../domain/hosts.errors';
import { generatePairingTokenSecret } from '../../domain/pairing-token-secret.factory';
import { HOST_PAIRING_TOKEN_REPOSITORY } from '../../hosts.di-tokens';
import { RunnerReleaseConfig } from '../../infrastructure/runner-release.config';
import { MintPairingTokenCommand } from './mint-pairing-token.command';

/**
 * How long a registration token is good for. An hour is the span of "I am
 * sitting at the machine now": long enough to find a terminal, short enough that
 * a token left in a chat log is worthless by the time anyone reads it.
 */
const LIFETIME_MS = 60 * 60 * 1000;

/**
 * What the caller gets back.
 *
 * Commands normally return only the aggregate id and the controller re-reads
 * through a query. Not here, for two reasons: the secret exists only inside this
 * handler — the row holds its digest, so no follow-up query could ever recover
 * it — and the row itself was just written by this transaction, so bouncing it
 * back through the query bus would be a second read of something already in
 * hand.
 */
export interface MintPairingTokenResult {
  token: HostPairingTokenEntity;
  installCommand: string;
  agentPrompt: string;
}

/**
 * Mints a registration token and the instructions that spend it.
 *
 * The instructions are templated from deploy-owned configuration rather than
 * stored, so nothing a workspace can write ends up as a command someone pastes
 * into a terminal.
 */
@CommandHandler(MintPairingTokenCommand)
export class MintPairingTokenCommandHandler
  implements ICommandHandler<MintPairingTokenCommand, MintPairingTokenResult>
{
  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
    private readonly release: RunnerReleaseConfig,
  ) {}

  async execute(command: MintPairingTokenCommand): Promise<MintPairingTokenResult> {
    // With no runner release to point at there is nothing to hand the machine,
    // and minting a credential nobody could spend would be worse than refusing.
    if (!this.release.isConfigured) {
      throw new AppError(HostErrors.NOT_CONFIGURED, {
        detail:
          'No runner release is configured, so there is no install command to hand a machine.',
      });
    }

    const secret = generatePairingTokenSecret();
    const token = HostPairingTokenEntity.mint({
      ownerUserId: command.userId,
      intendedName: command.name,
      prefix: secret.prefix,
      tokenHash: secret.hash,
      createdFromIp: command.createdFromIp,
      expiresAt: new Date(Date.now() + LIFETIME_MS),
    });

    await this.tokens.insert(token);

    return {
      token,
      installCommand: this.release.installCommandFor(secret.secret),
      agentPrompt: this.release.agentPromptFor(secret.secret),
    };
  }
}
