import { Inject, Injectable } from '@nestjs/common';
import type { BotProvider, BotTurnOrigin } from '@oppenheimer/shared';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
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
 * The bot's last turn is read only for an origin the hold applies to, and the
 * provider's keys only after a refusal for credit.
 */
@Injectable()
export class BotTurnHoldPolicy {
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
  ) {}

  async held(turn: HoldCandidate, now: Date): Promise<boolean> {
    if (!holdableOrigin(turn.origin)) return false;
    const last = await this.turns.findLastOnProvider(
      turn.organizationId,
      turn.botId,
      turn.provider,
    );
    // Asked only of a refusal for credit, which another key can get past.
    const keyLeft =
      last?.failure === 'usage_limit' &&
      (await this.credentials.hasUnspentKey(turn.organizationId, turn.provider));
    return heldByProvider(turn, last, now, keyLeft);
  }
}
