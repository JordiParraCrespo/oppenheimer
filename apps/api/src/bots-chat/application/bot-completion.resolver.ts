import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotCompletionRequest, BotEngine } from '@oppenheimer/backend-agents';
import type { BotModelCallPurpose } from '@oppenheimer/shared';
import { BOT_ENGINE, BOT_USAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotUsageRepositoryPort } from '../database/bot-usage.repository.port';

/** Whose call it is and why: what its spend is recorded against (`/usage`). */
export interface BotCompletionFor {
  organizationId: string;
  botId: string;
  purpose: BotModelCallPurpose;
}

/**
 * One model call for a bot with no tools (a summary, a review of the owner's
 * rules, a goal's verdict), in a scratch directory of its own. The engine
 * needs one even with no tools: the Claude engine runs its SDK's process in
 * it. The directory is made for the call and removed after it, however the
 * call ends; a failure to remove it is not the call's.
 *
 * What the call spent is recorded against the bot (`25-bots.md` §4.1,
 * `/usage`), when the provider said. The record is best-effort: one that
 * fails is logged, and the call's answer stands.
 */
@Injectable()
export class BotCompletionResolver {
  private readonly logger = new Logger(BotCompletionResolver.name);

  constructor(
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    @Inject(BOT_USAGE_REPOSITORY) private readonly usage: BotUsageRepositoryPort,
  ) {}

  async complete(
    request: Omit<BotCompletionRequest, 'scratchDir'>,
    call: BotCompletionFor,
  ): Promise<string> {
    const scratchDir = await mkdtemp(join(tmpdir(), `bot-${call.purpose}-`));
    try {
      const { text, usage } = await this.engine.completeWithUsage({ ...request, scratchDir });
      if (usage) {
        await this.usage
          .recordCall({ ...call, provider: request.provider, model: request.model, ...usage })
          .catch((error: unknown) =>
            this.logger.warn(
              { message: "A bot's call spend was not recorded", ...call },
              error instanceof Error ? error.stack : String(error),
            ),
          );
      }
      return text;
    } finally {
      await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
