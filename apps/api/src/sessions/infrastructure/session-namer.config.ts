import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sessionNamerIsConfigured } from '../../config/sessions.config';

/**
 * The naming job's own settings: which model to ask and how long to wait. The
 * provider itself is the deployment's `LlmService` (`LLM_PROVIDER`).
 */
@Injectable()
export class SessionNamerConfig {
  constructor(private readonly configService: ConfigService) {}

  /**
   * `SESSION_NAMER_MODEL`, else `LLM_MODEL`. Nothing here defaults it: a model id
   * is a moving target this repository is in no position to keep current.
   */
  get model(): string | undefined {
    return (
      this.configService.get<string>('sessions.namerModel') ??
      this.configService.get<string>('llm.model')
    );
  }

  /** How long a create waits for a title before the prompt's words stand in. */
  get timeoutMs(): number {
    return this.configService.get<number>('sessions.namerTimeoutMs') ?? 2_000;
  }

  /** The same predicate the capability reports, not a second copy of it. */
  get isConfigured(): boolean {
    return sessionNamerIsConfigured(this.configService);
  }
}
