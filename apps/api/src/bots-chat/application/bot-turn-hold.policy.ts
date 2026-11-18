import { Inject, Injectable } from '@nestjs/common';
import type { BotProvider, BotTurnOrigin } from '@oppenheimer/shared';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { heldByProvider, holdableOrigin } from '../domain/bot-provider-hold.policy';

/** The turn that would run, as the hold reads it: whose, on what, and why. */
export interface HoldCandidate {
  organizationId: string;
  botId: string;
  provider: BotProvider;
  origin: BotTurnOrigin;
}

/**
 * Whether a turn nobody asked for would run into a provider that just
 * refused the bot's account (`bot-provider-hold.policy.ts`), asked the same
 * way wherever it is: before a routine's run queues its turn
 * (`BotRoutineTarget`) and as a wake's turn starts (`BotTurnContextResolver`).
 * The bot's last turn is read only for an origin the hold applies to.
 */
@Injectable()
export class BotTurnHoldPolicy {
  constructor(@Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort) {}

  async held(turn: HoldCandidate, now: Date): Promise<boolean> {
    if (!holdableOrigin(turn.origin)) return false;
    const last = await this.turns.findLastOnProvider(
      turn.organizationId,
      turn.botId,
      turn.provider,
    );
    return heldByProvider(turn, last, now);
  }
}
