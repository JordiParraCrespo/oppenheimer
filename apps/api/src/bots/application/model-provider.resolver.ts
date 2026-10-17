import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { type BotProvider, botProviderSchema } from '@oppenheimer/shared';
import { PROVIDER_KEY_SEALER } from '../bots.di-tokens';
import { BotErrors } from '../domain/bots.errors';
import type { ProviderKeySealerPort } from '../infrastructure/provider-key-sealer.port';

/** What every provider route checks first: a provider the catalog lists, and a sealing key to use. */
@Injectable()
export class ModelProviderResolver {
  constructor(
    @Inject(PROVIDER_KEY_SEALER)
    private readonly sealer: ProviderKeySealerPort,
  ) {}

  provider(value: string): BotProvider {
    const parsed = botProviderSchema.safeParse(value);
    if (!parsed.success) {
      throw new AppError(BotErrors.PROVIDER_NOT_FOUND, { detail: `${value} is not a provider` });
    }
    return parsed.data;
  }

  /** Refuses, before anything is read or written, on a server with no `BOTS_PROVIDER_KEY`. */
  assertConfigured(): void {
    if (!this.sealer.isConfigured()) throw new AppError(BotErrors.PROVIDERS_NOT_CONFIGURED);
  }
}
