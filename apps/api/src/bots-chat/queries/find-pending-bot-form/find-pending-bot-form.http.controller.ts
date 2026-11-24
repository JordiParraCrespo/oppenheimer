import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotFormMapper } from '../../bot-form.mapper';
import type { BotFormEntity } from '../../domain/bot-form.entity';
import { BotPendingFormResponseDto } from '../../dtos/bot-form.response.dto';
import { FindPendingBotFormQuery } from './find-pending-bot-form.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindPendingBotFormHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotFormMapper,
  ) {}

  @Get(':id/form')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's waiting form",
    description:
      'The form the bot asked you to fill with `ask_form` and is waiting on; null when none waits. A bot has one card up at a time: a form, questions or an approval.',
  })
  @ApiResponse({ status: 200, type: BotPendingFormResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotPendingFormResponseDto> {
    const form = await this.queryBus.execute<FindPendingBotFormQuery, BotFormEntity | null>(
      new FindPendingBotFormQuery(scope, botId),
    );
    return this.mapper.toPendingResponse(form);
  }
}
