import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { BotCompletionRequest, BotEngine } from '@oppenheimer/backend-agents';
import { BOT_ENGINE } from '../bots-chat.di-tokens';

/**
 * One model call for a bot with no tools (a summary, a review of the owner's
 * rules, a goal's verdict), in a scratch directory of its own. The engine
 * needs one even with no tools: the Claude engine runs its SDK's process in
 * it. The directory is made for the call and removed after it, however the
 * call ends; a failure to remove it is not the call's.
 */
@Injectable()
export class BotCompletionResolver {
  constructor(@Inject(BOT_ENGINE) private readonly engine: BotEngine) {}

  async complete(
    request: Omit<BotCompletionRequest, 'scratchDir'>,
    purpose: string,
  ): Promise<string> {
    const scratchDir = await mkdtemp(join(tmpdir(), `bot-${purpose}-`));
    try {
      return await this.engine.complete({ ...request, scratchDir });
    } finally {
      await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
