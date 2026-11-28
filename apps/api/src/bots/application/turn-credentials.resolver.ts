import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import {
  type BotTurnFailure,
  MODEL_PROVIDER_CATALOG,
  type ModelProvider,
} from '@oppenheimer/shared';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, PROVIDER_KEY_SEALER } from '../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../database/model-provider-credential.repository.port';
import { BotErrors } from '../domain/bots.errors';
import type { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import type { ProviderKeySealerPort } from '../infrastructure/provider-key-sealer.port';
import { ChatgptCredentialResolver } from './chatgpt-credential.resolver';
import type { TurnCredential, TurnCredentialsPort } from './turn-credentials.port';

type CredentialSource = (organizationId: string, now: Date) => Promise<TurnCredential>;

/**
 * Each provider's way to the credential a turn runs on, declared once: a
 * provider added to `MODEL_PROVIDERS` does not compile until it names one here.
 * A key is the provider's first stored key that is not spent, opened
 * (`keysInTurnOrder`); a sign-in (ChatGPT) is its own resolver, which
 * refreshes the token it holds. A call refused for credit reports it
 * (`spent`), which marks the key and hands out the next.
 */
@Injectable()
export class TurnCredentialsResolver implements TurnCredentialsPort {
  private readonly sources: Readonly<Record<ModelProvider, CredentialSource>>;

  constructor(
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    chatgpt: ChatgptCredentialResolver,
  ) {
    const key =
      (provider: ModelProvider): CredentialSource =>
      (organizationId) =>
        this.keyFor(organizationId, provider);
    this.sources = {
      anthropic: key('anthropic'),
      glm: key('glm'),
      openai: key('openai'),
      chatgpt: (organizationId, now) => chatgpt.turnCredential(organizationId, now),
      xai: key('xai'),
      groq: key('groq'),
      elevenlabs: key('elevenlabs'),
    };
  }

  forTurn(organizationId: string, provider: ModelProvider, now: Date): Promise<TurnCredential> {
    return this.sources[provider](organizationId, now);
  }

  async has(organizationId: string, provider: ModelProvider): Promise<boolean> {
    if (!this.sealer.isConfigured()) return false;
    return (await this.credentials.findForRun(organizationId, provider)).isSome();
  }

  async spent(
    organizationId: string,
    provider: ModelProvider,
    used: TurnCredential,
    now: Date,
  ): Promise<TurnCredential | null> {
    const stored = await this.storedKey(organizationId, provider, used);
    if (!stored) return null;
    await this.credentials.markSpent(stored, now);
    const next = (await this.credentials.findAllForRun(organizationId, provider))[0];
    if (!next || next.spentAt !== null || next.id === stored.id) return null;
    return this.opened(next);
  }

  async keyLeftAfter(
    organizationId: string,
    provider: ModelProvider,
    failure: BotTurnFailure | null | undefined,
  ): Promise<boolean> {
    if (failure !== 'usage_limit') return false;
    if (MODEL_PROVIDER_CATALOG[provider].auth !== 'api_key') return false;
    const first = (await this.credentials.findAllForRun(organizationId, provider))[0];
    return first !== undefined && first.spentAt === null;
  }

  async worked(
    organizationId: string,
    provider: ModelProvider,
    used: TurnCredential,
  ): Promise<void> {
    const stored = await this.storedKey(organizationId, provider, used);
    if (stored?.spentAt) await this.credentials.clearSpent(stored);
  }

  /** The stored key `used` was opened from, while it still holds that secret; null for a sign-in or a key replaced since. */
  private async storedKey(
    organizationId: string,
    provider: ModelProvider,
    used: TurnCredential,
  ): Promise<ModelProviderCredentialEntity | null> {
    if (!used.keyId || !this.sealer.isConfigured()) return null;
    const keys = await this.credentials.findAllForRun(organizationId, provider);
    const stored = keys.find((key) => key.id === used.keyId);
    if (!stored || this.sealer.open(stored.sealedKey) !== used.apiKey) return null;
    return stored;
  }

  private async keyFor(organizationId: string, provider: ModelProvider): Promise<TurnCredential> {
    const stored = await this.credentials.findForRun(organizationId, provider);
    if (stored.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
    }
    return this.opened(stored.unwrap());
  }

  private opened(stored: ModelProviderCredentialEntity): TurnCredential {
    return { apiKey: this.sealer.open(stored.sealedKey), keyId: stored.id };
  }
}
