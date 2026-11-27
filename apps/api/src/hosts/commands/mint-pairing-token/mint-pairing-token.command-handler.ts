import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../../auth/auth.di-tokens';
import { AuthErrors } from '../../../auth/domain/auth.errors';
import { mayIssueCredential } from '../../../auth/domain/credential-issuance.policy';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { HostErrors } from '../../domain/hosts.errors';
import { generatePairingTokenSecret } from '../../domain/pairing-token-secret.factory';
import { HOST_PAIRING_TOKEN_REPOSITORY } from '../../hosts.di-tokens';
import { RunnerReleaseConfig } from '../../infrastructure/runner-release.config';
import { MintPairingTokenCommand } from './mint-pairing-token.command';

/**
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
  installScriptSha256: string | null;
  agentPrompt: string;
}

/**
 * A paired host is a credential of its own, and one a password reset leaves
 * alone (unpairing every machine on a reset would cost a real owner their
 * hosts), so the account must have proven its email address before it may
 * pair one: otherwise whoever registered the address first keeps a machine
 * the real owner's recovery cannot reach.
 */
@CommandHandler(MintPairingTokenCommand)
export class MintPairingTokenCommandHandler
  implements ICommandHandler<MintPairingTokenCommand, MintPairingTokenResult>
{
  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
    private readonly release: RunnerReleaseConfig,
    private readonly configService: ConfigService,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
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

    // After the deployment's answer, so `GET /health/capabilities` still says
    // what minting would. Read fresh: the session cache holds a copy of the user.
    const owner = await this.owners.requireActiveOwner(command.userId);
    if (!mayIssueCredential(owner)) throw new AppError(AuthErrors.EMAIL_VERIFICATION_REQUIRED);

    const now = new Date();
    const replacing = await this.replacedToken(command);
    replacing?.revoke(now);

    const lifetimeMs = this.lifetimeMs;
    const cap = this.maxSpendableTokens;
    const secret = generatePairingTokenSecret();
    const token = HostPairingTokenEntity.mint({
      ownerUserId: command.userId,
      intendedName: command.name,
      prefix: secret.prefix,
      tokenHash: secret.hash,
      createdFromIp: command.createdFromIp,
      expiresAt: new Date(now.getTime() + lifetimeMs),
    });

    const minted = await this.tokens.insertWithinCap(token, {
      cap,
      now,
      replacing,
    });
    if (!minted) {
      throw new AppError(HostErrors.TOO_MANY_PAIRING_TOKENS, {
        detail: `You already hold ${cap} unspent pairing tokens. Pair a machine with one, or wait for them to expire; each expires ${Math.ceil(lifetimeMs / 60_000)} minutes after it is created.`,
      });
    }

    return {
      token,
      installCommand: this.release.installCommandFor(secret.secret),
      installScriptSha256: this.release.installScriptSha256,
      agentPrompt: this.release.agentPromptFor(secret.secret),
    };
  }

  /** Short-lived on purpose: why is on `pairingTokenTtlSeconds` in hosts.config.ts. */
  private get lifetimeMs(): number {
    return this.configService.getOrThrow<number>('hosts.pairingTokenTtlSeconds') * 1000;
  }

  /** A handful, not a drawer: why is on `maxUnspentPairingTokens` in hosts.config.ts. */
  private get maxSpendableTokens(): number {
    return this.configService.getOrThrow<number>('hosts.maxUnspentPairingTokens');
  }

  /** The caller's own token this mint replaces; missing is an error, not a plain mint. */
  private async replacedToken(
    command: MintPairingTokenCommand,
  ): Promise<HostPairingTokenEntity | undefined> {
    if (!command.replaces) return undefined;
    const found = await this.tokens.findOneById(command.scope, command.replaces);
    if (found.isNone()) {
      throw new AppError(HostErrors.PAIRING_TOKEN_NOT_FOUND, {
        detail: `No pairing token with id ${command.replaces}`,
      });
    }
    return found.unwrap();
  }
}
