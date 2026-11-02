import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import type { BotModelCallPurpose, BotProvider, BotUsage } from '@oppenheimer/shared';
import type { EntityManager, Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { type BotModelCall, botUsageOf, tokenCount } from '../domain/bot-usage.policy';
import { BotModelCallOrmEntity } from './bot-model-call.orm-entity';
import type { BotUsageRepositoryPort } from './bot-usage.repository.port';

/** One row of a sum: Postgres answers `bigint` sums as strings. */
type SumRow = Record<string, unknown>;

const TOKEN_SUMS = `
  sum("inputTokens")::bigint AS "inputTokens",
  sum("outputTokens")::bigint AS "outputTokens",
  sum("cacheReadTokens")::bigint AS "cacheReadTokens",
  sum("cacheWriteTokens")::bigint AS "cacheWriteTokens"`;

/**
 * What a bot spends (`25-bots.md` §4.1, `/usage`): its turns summed by model
 * (`IDX_bot_turn_bot`), only those that started, and its calls outside them
 * summed by purpose (`IDX_bot_model_call_bot`). Two grouped reads, each a
 * handful of rows whatever the chat's length.
 */
@Injectable()
export class BotUsageRepository
  extends ScopedRepositoryBase<BotModelCallOrmEntity>
  implements BotUsageRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'call';

  constructor(
    @InjectRepository(BotModelCallOrmEntity)
    protected readonly repository: Repository<BotModelCallOrmEntity>,
  ) {
    super();
  }

  async recordCall(call: BotModelCall): Promise<void> {
    await this.repository.insert({
      organizationId: call.organizationId,
      botId: call.botId,
      purpose: call.purpose,
      provider: call.provider,
      model: call.model,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      cacheReadTokens: call.cacheReadTokens,
      cacheWriteTokens: call.cacheWriteTokens,
    });
  }

  async findForBot(organizationId: string, botId: string): Promise<BotUsage> {
    const [turns, calls]: [SumRow[], SumRow[]] = await Promise.all([
      this.repository.query(
        `SELECT provider, model, count(*)::int AS turns, ${TOKEN_SUMS},
                sum(extract(epoch FROM (coalesce("endedAt", now()) - "startedAt")) * 1000)::bigint AS "activeMs",
                min("createdAt") AS "firstAt"
           FROM bot_turn
          WHERE "organizationId" = $1 AND "botId" = $2 AND "startedAt" IS NOT NULL
          GROUP BY provider, model`,
        [organizationId, botId],
      ),
      this.repository.query(
        `SELECT purpose, count(*)::int AS calls, ${TOKEN_SUMS}
           FROM bot_model_call
          WHERE "organizationId" = $1 AND "botId" = $2
          GROUP BY purpose`,
        [organizationId, botId],
      ),
    ]);
    const counts = (row: SumRow) => ({
      inputTokens: tokenCount(row.inputTokens),
      outputTokens: tokenCount(row.outputTokens),
      cacheReadTokens: tokenCount(row.cacheReadTokens),
      cacheWriteTokens: tokenCount(row.cacheWriteTokens),
    });
    return botUsageOf({
      turns: turns.map((row) => ({
        provider: String(row.provider) as BotProvider,
        model: String(row.model),
        turns: tokenCount(row.turns),
        ...counts(row),
        activeMs: tokenCount(row.activeMs),
        firstAt: new Date(String(row.firstAt)),
      })),
      background: calls.map((row) => ({
        purpose: String(row.purpose) as BotModelCallPurpose,
        calls: tokenCount(row.calls),
        ...counts(row),
      })),
    });
  }
}

/**
 * Clears what a bot's chat spent outside its turns, in the transaction that
 * clears the chat (`BotTurnRepository.clearConversation`): the turns go with
 * the conversation, and these with them, so `/usage` always counts one chat
 * (IDX_bot_model_call_bot).
 */
export async function clearModelCallsWithin(
  manager: EntityManager,
  organizationId: string,
  botId: string,
): Promise<void> {
  await manager.delete(BotModelCallOrmEntity, { organizationId, botId });
}
