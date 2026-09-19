import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The providers a deployment can name sessions with. `none` is the default. */
export type SessionNamerProvider = 'none' | 'anthropic';

/**
 * Which namer this deployment has, and what it needs to run.
 *
 * Three environment variables, read in one place:
 * `SESSION_NAMER_PROVIDER`, `SESSION_NAMER_MODEL` and `ANTHROPIC_API_KEY`
 * (root `.env.example`). A provider switched on without its key or its model is
 * **not configured** rather than half-configured — the factory then binds the no-op
 * adapter and every session keeps its slug, which is a supported outcome and not a
 * failure.
 */
@Injectable()
export class SessionNamerConfig {
  constructor(private readonly configService: ConfigService) {}

  get provider(): SessionNamerProvider {
    return this.configService.get<SessionNamerProvider>('sessions.namerProvider') ?? 'none';
  }

  /**
   * The model id, verbatim from configuration. Nothing here defaults it: a model id
   * is a moving target, and hard-coding one would make every deployment inherit a
   * choice this repository is in no position to keep current.
   */
  get model(): string | undefined {
    return this.configService.get<string>('sessions.namerModel');
  }

  get anthropicApiKey(): string | undefined {
    return this.configService.get<string>('sessions.anthropicApiKey');
  }

  /** Whether the configured provider has everything it needs. */
  get isConfigured(): boolean {
    if (this.provider === 'anthropic') return Boolean(this.anthropicApiKey && this.model);
    return false;
  }
}
