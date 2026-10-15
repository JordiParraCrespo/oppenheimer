import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import {
  CHATGPT_AUTH,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../bots.di-tokens';
import { ChatgptSignInMapper } from '../chatgpt-sign-in.mapper';
import type { ModelProviderCredentialRepositoryPort } from '../database/model-provider-credential.repository.port';
import { BotErrors } from '../domain/bots.errors';
import { isChatgptTokenFresh } from '../domain/chatgpt-login.policy';
import {
  keyHintOf,
  ModelProviderCredentialEntity,
} from '../domain/model-provider-credential.entity';
import {
  type ChatgptAuthPort,
  ChatgptAuthRefusedError,
  type ChatgptTokens,
} from '../infrastructure/chatgpt-auth.port';
import type { ProviderKeySealerPort } from '../infrastructure/provider-key-sealer.port';
import type { TurnCredential } from './turn-credentials.port';

/**
 * How long another replica is kept from refreshing the same sign-in: longer
 * than a refresh takes (one call, ten seconds at most), and released as soon
 * as it ends.
 */
const REFRESH_LOCK_SECONDS = 30;

function credentialOf({ accessToken, accountId }: ChatgptTokens): TurnCredential {
  return { apiKey: accessToken, accountId };
}

/**
 * A workspace's ChatGPT sign-in (`product/versions/mvp/25-bots.md` §2): stored
 * as a model provider credential whose sealed secret is the sign-in's tokens
 * rather than a key, and refreshed by the worker when a turn finds the access
 * token about to lapse.
 *
 * ChatGPT rotates the refresh token on every use, so one refresh runs per
 * workspace at a time. Turns on this replica that need it while it runs wait
 * for that refresh and take its answer; a turn on another replica finds the
 * lock held and, unless the token stored by then is fresh, fails at once with
 * `BOTS_019` rather than sleeping on a guess. The write is conditional on the
 * secret that was read, so a new sign-in landing first is never overwritten;
 * a refresh ChatGPT refuses removes the sign-in the same way, and the turn
 * fails with `BOTS_013`, which tells the person to sign in again.
 */
@Injectable()
export class ChatgptCredentialResolver {
  private readonly logger = new Logger(ChatgptCredentialResolver.name);
  /** The refresh running on this replica, per workspace, for the turns that ask while it runs. */
  private readonly refreshing = new Map<string, Promise<TurnCredential>>();

  constructor(
    @Inject(CHATGPT_AUTH) private readonly auth: ChatgptAuthPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    private readonly mapper: ChatgptSignInMapper,
    private readonly cache: CacheService,
  ) {}

  /** Stores a finished sign-in for the workspace, replacing whatever ChatGPT credential was there. */
  async connect(organizationId: string, userId: string, tokens: ChatgptTokens): Promise<string> {
    const credential = ModelProviderCredentialEntity.createNew({
      organizationId,
      provider: 'chatgpt',
      sealedKey: this.sealer.seal(this.mapper.toSecret(tokens)),
      keyHint: keyHintOf(tokens.accountId),
      updatedByUserId: userId,
    });
    await this.credentials.put(credential);
    return credential.id;
  }

  /** What a turn of a bot in `organizationId` runs on, refreshed first when it is about to lapse. */
  async turnCredential(organizationId: string, now: Date): Promise<TurnCredential> {
    const credential = await this.read(organizationId);
    const tokens = this.tokensOf(credential);
    if (isChatgptTokenFresh(tokens.expiresAt, now)) return credentialOf(tokens);

    const running = this.refreshing.get(organizationId);
    if (running) return running;
    const refresh = this.refreshOnce(credential, tokens, now).finally(() =>
      this.refreshing.delete(organizationId),
    );
    this.refreshing.set(organizationId, refresh);
    return refresh;
  }

  /** The one refresh across replicas, or the token another replica's refresh already stored. */
  private async refreshOnce(
    credential: ModelProviderCredentialEntity,
    tokens: ChatgptTokens,
    now: Date,
  ): Promise<TurnCredential> {
    const lock = `bots:chatgpt:refresh:${credential.organizationId}`;
    if (!(await this.cache.setIfAbsent(lock, 1, REFRESH_LOCK_SECONDS))) {
      const stored = this.tokensOf(await this.read(credential.organizationId));
      if (isChatgptTokenFresh(stored.expiresAt, now)) return credentialOf(stored);
      throw new AppError(BotErrors.CHATGPT_REFRESHING);
    }
    try {
      return await this.refresh(credential, tokens);
    } finally {
      await this.cache.del(lock);
    }
  }

  private async refresh(
    credential: ModelProviderCredentialEntity,
    tokens: ChatgptTokens,
  ): Promise<TurnCredential> {
    let next: ChatgptTokens;
    try {
      next = await this.auth.refresh(tokens.refreshToken);
    } catch (error) {
      if (!(error instanceof ChatgptAuthRefusedError)) throw error;
      const removed = await this.credentials.deleteIfUnchanged(credential);
      this.logger.warn({
        message: 'ChatGPT refused to refresh a sign-in; the workspace must sign in again',
        organizationId: credential.organizationId,
        removed,
      });
      if (!removed) return credentialOf(this.tokensOf(await this.read(credential.organizationId)));
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING, {
        detail: 'The ChatGPT sign-in has lapsed. Sign in again in Settings → Model providers.',
      });
    }
    const stored = await this.credentials.replaceSecretIfUnchanged(
      credential,
      this.sealer.seal(this.mapper.toSecret(next)),
      keyHintOf(next.accountId),
    );
    // A new sign-in landed while this one refreshed: the workspace's choice wins.
    return credentialOf(stored ? next : this.tokensOf(await this.read(credential.organizationId)));
  }

  private async read(organizationId: string): Promise<ModelProviderCredentialEntity> {
    const stored = await this.credentials.findForRun(organizationId, 'chatgpt');
    if (stored.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
    }
    return stored.unwrap();
  }

  /** A secret that does not open to tokens (sealed under a replaced key, written by hand) is no sign-in. */
  private tokensOf(credential: ModelProviderCredentialEntity): ChatgptTokens {
    let tokens: ChatgptTokens | null = null;
    try {
      tokens = this.mapper.tokensOf(this.sealer.open(credential.sealedKey));
    } catch {
      tokens = null;
    }
    if (!tokens) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING, {
        detail:
          'The stored ChatGPT sign-in cannot be read. Sign in again in Settings → Model providers.',
      });
    }
    return tokens;
  }
}
