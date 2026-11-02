import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { BotProvider } from '@oppenheimer/shared';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, PROVIDER_KEY_SEALER } from '../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../database/model-provider-credential.repository.port';
import { BotErrors } from '../domain/bots.errors';
import type { ProviderKeySealerPort } from '../infrastructure/provider-key-sealer.port';
import { ChatgptCredentialResolver } from './chatgpt-credential.resolver';
import type { TurnCredential, TurnCredentialsPort } from './turn-credentials.port';

type CredentialSource = (organizationId: string, now: Date) => Promise<TurnCredential>;

/**
 * Each provider's way to the credential a turn runs on, declared once: a
 * provider added to `BOT_PROVIDERS` does not compile until it names one here.
 * A key is the stored one, opened; a sign-in (ChatGPT) is its own resolver,
 * which refreshes the token it holds.
 */
@Injectable()
export class TurnCredentialsResolver implements TurnCredentialsPort {
  private readonly sources: Readonly<Record<BotProvider, CredentialSource>>;

  constructor(
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    chatgpt: ChatgptCredentialResolver,
  ) {
    const key =
      (provider: BotProvider): CredentialSource =>
      (organizationId) =>
        this.keyFor(organizationId, provider);
    this.sources = {
      anthropic: key('anthropic'),
      glm: key('glm'),
      openai: key('openai'),
      chatgpt: (organizationId, now) => chatgpt.turnCredential(organizationId, now),
      xai: key('xai'),
    };
  }

  forTurn(organizationId: string, provider: BotProvider, now: Date): Promise<TurnCredential> {
    return this.sources[provider](organizationId, now);
  }

  async has(organizationId: string, provider: BotProvider): Promise<boolean> {
    if (!this.sealer.isConfigured()) return false;
    return (await this.credentials.findForRun(organizationId, provider)).isSome();
  }

  private async keyFor(organizationId: string, provider: BotProvider): Promise<TurnCredential> {
    const stored = await this.credentials.findForRun(organizationId, provider);
    if (stored.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
    }
    return { apiKey: this.sealer.open(stored.unwrap().sealedKey) };
  }
}
