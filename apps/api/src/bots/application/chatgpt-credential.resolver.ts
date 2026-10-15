import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import {
  CHATGPT_AUTH,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../bots.di-tokens';
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
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';
import type { ChatgptAccess, ChatgptCredentialsPort } from './chatgpt-credentials.port';

/** One refresh per workspace at a time: ChatGPT rotates the refresh token on every use. */
const REFRESH_LOCK_SECONDS = 30;
/** How long a turn that finds another refresh running waits before it reads what that one stored. */
const REFRESH_WAIT_MS = 1_000;

function accessOf({ accessToken, accountId }: ChatgptTokens): ChatgptAccess {
  return { accessToken, accountId };
}

/**
 * A workspace's ChatGPT sign-in (`product/versions/mvp/25-bots.md` §2): stored
 * as a model provider credential whose sealed secret is the sign-in's tokens
 * rather than a key, and refreshed by the worker when a turn finds the access
 * token about to lapse.
 *
 * The refresh is a conditional write on the secret the turn read, so a second
 * refresh or a new sign-in landing first is never overwritten; a refresh
 * ChatGPT refuses removes the sign-in, the same way, and the turn fails with
 * `BOTS_013`, which tells the person to sign in again.
 */
@Injectable()
export class ChatgptCredentialResolver implements ChatgptCredentialsPort {
  private readonly logger = new Logger(ChatgptCredentialResolver.name);

  constructor(
    @Inject(CHATGPT_AUTH) private readonly auth: ChatgptAuthPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    private readonly mapper: ModelProviderCredentialMapper,
    private readonly cache: CacheService,
  ) {}

  /** Stores a finished sign-in for the workspace, replacing whatever ChatGPT credential was there. */
  async connect(organizationId: string, userId: string, tokens: ChatgptTokens): Promise<string> {
    const credential = ModelProviderCredentialEntity.createNew({
      organizationId,
      provider: 'chatgpt',
      sealedKey: this.sealer.seal(this.mapper.toChatgptSecret(tokens)),
      keyHint: keyHintOf(tokens.accountId),
      updatedByUserId: userId,
    });
    await this.credentials.put(credential);
    return credential.id;
  }

  /** The access a turn of a bot in `organizationId` runs on, refreshed first when it is about to lapse. */
  async accessFor(organizationId: string, now: Date): Promise<ChatgptAccess> {
    const credential = await this.read(organizationId);
    const tokens = this.tokensOf(credential);
    if (isChatgptTokenFresh(tokens.expiresAt, now)) return accessOf(tokens);

    const lock = `bots:chatgpt:refresh:${organizationId}`;
    if (!(await this.cache.setIfAbsent(lock, 1, REFRESH_LOCK_SECONDS))) {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_WAIT_MS));
      const after = this.tokensOf(await this.read(organizationId));
      if (isChatgptTokenFresh(after.expiresAt, now)) return accessOf(after);
      throw new AppError(BotErrors.CHATGPT_UNREACHABLE, {
        detail: 'Another turn is refreshing the ChatGPT sign-in; try again shortly',
      });
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
  ): Promise<ChatgptAccess> {
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
      if (!removed) return accessOf(this.tokensOf(await this.read(credential.organizationId)));
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING, {
        detail: 'The ChatGPT sign-in has lapsed. Sign in again in Settings → Model providers.',
      });
    }
    const stored = await this.credentials.rotateSecret(
      credential,
      this.sealer.seal(this.mapper.toChatgptSecret(next)),
      keyHintOf(next.accountId),
    );
    // A new sign-in landed while this one refreshed: the workspace's choice wins.
    return accessOf(stored ? next : this.tokensOf(await this.read(credential.organizationId)));
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
      tokens = this.mapper.chatgptTokensOf(this.sealer.open(credential.sealedKey));
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
