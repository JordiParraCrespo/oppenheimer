import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotSteer, BotSteering } from '@oppenheimer/backend-agents';
import { BotMessageMapper } from '../bot-message.mapper';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { takesSteer } from '../domain/bot-steer.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * A running turn's steering (Codex's `turn/steer`): what the engine asks at
 * each tool call for the messages its sender steered meanwhile. Each ask
 * takes them out of the queue for good (`takeSteers`), so the engine hands
 * them to the model once; a read that fails is logged and takes nothing,
 * and the steers wait for the next ask or run as their own turns.
 */
@Injectable()
export class BotSteeringFactory {
  private readonly logger = new Logger(BotSteeringFactory.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly mapper: BotMessageMapper,
  ) {}

  steering(turn: BotTurnEntity): BotSteering {
    return { take: () => this.take(turn) };
  }

  private async take(turn: BotTurnEntity): Promise<BotSteer[]> {
    try {
      const taken = await this.turns.takeSteers(turn, (waiting) => takesSteer(turn, waiting));
      return taken.map((steer) => this.mapper.toEngineSteer(steer));
    } catch (error) {
      this.logger.warn({
        message: 'Could not take the steers of a bot turn',
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
