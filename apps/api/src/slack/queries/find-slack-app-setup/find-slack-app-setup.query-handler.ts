import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { BotEntity } from '../../../bots/domain/bot.entity';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { SlackErrors } from '../../domain/slack.errors';
import type { SlackAppSetupResponseDto } from '../../dtos/slack-app-setup.response.dto';
import type { SlackSealerPort } from '../../infrastructure/slack-sealer.port';
import { SLACK_SEALER } from '../../slack.di-tokens';
import { SlackAccountMapper } from '../../slack-account.mapper';
import { FindSlackAppSetupQuery } from './find-slack-app-setup.query';

/**
 * What creating one of the caller's bots' Slack app takes: the bot's events
 * address on this API's public origin, and its manifest (the bot's name and
 * description, the scopes and events it needs) as Slack's "Create an app"
 * link. `SLACK_003` while this server keeps no Slack tokens.
 */
@QueryHandler(FindSlackAppSetupQuery)
export class FindSlackAppSetupQueryHandler
  implements IQueryHandler<FindSlackAppSetupQuery, SlackAppSetupResponseDto>
{
  constructor(
    private readonly queryBus: QueryBus,
    private readonly config: ConfigService,
    @Inject(SLACK_SEALER) private readonly sealer: SlackSealerPort,
    private readonly mapper: SlackAccountMapper,
  ) {}

  async execute({ scope, botId }: FindSlackAppSetupQuery): Promise<SlackAppSetupResponseDto> {
    if (!this.sealer.isConfigured()) throw new AppError(SlackErrors.NOT_CONFIGURED);
    const bot = await this.queryBus.execute<FindBotQuery, BotEntity>(
      new FindBotQuery({ scope, botId }),
    );
    const origin =
      this.config.get<string>('slack.eventsBaseUrl') ??
      this.config.get<string>('app.betterAuthUrl') ??
      'http://localhost:3001';
    return this.mapper.toSetupResponse(bot, origin);
  }
}
