import { Injectable } from '@nestjs/common';
import type { BotUsage } from '@oppenheimer/shared';
import {
  BotUsageBackgroundResponseDto,
  BotUsageModelResponseDto,
  BotUsageResponseDto,
} from './dtos/bot-usage.response.dto';

/** A bot's usage as `GET /bots/:id/usage` answers it. */
@Injectable()
export class BotUsageMapper {
  toResponse(usage: BotUsage): BotUsageResponseDto {
    const dto = new BotUsageResponseDto();
    dto.since = usage.since;
    dto.turns = usage.turns;
    dto.activeMs = usage.activeMs;
    dto.models = usage.models.map((model) => Object.assign(new BotUsageModelResponseDto(), model));
    dto.background = usage.background.map((row) =>
      Object.assign(new BotUsageBackgroundResponseDto(), row),
    );
    return dto;
  }
}
