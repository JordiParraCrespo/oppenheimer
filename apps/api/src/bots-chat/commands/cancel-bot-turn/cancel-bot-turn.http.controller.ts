import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotTurnMapper } from '../../bot-turn.mapper';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotTurnResponseDto } from '../../dtos/bot-turn.response.dto';
import { FindBotTurnQuery } from '../../queries/find-bot-turn/find-bot-turn.query';
import { CancelBotTurnCommand } from './cancel-bot-turn.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class CancelBotTurnHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotTurnMapper,
  ) {}

  @Post(':id/turns/:turnId/cancel')
  @Version('1')
  @HttpCode(202)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Stop a bot's turn",
    description:
      'A queued turn is cancelled at once; a running one is asked to stop and ends within a second (`cancelRequested` until then). An ended turn is left as it is.',
  })
  @ApiResponse({ status: 202, type: BotTurnResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Turn not found', code: 'BOTS_014' })
  async cancel(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('turnId', new ParseUUIDPipe()) turnId: string,
  ): Promise<BotTurnResponseDto> {
    await this.commandBus.execute<CancelBotTurnCommand, string>(
      new CancelBotTurnCommand({ scope, botId, turnId }),
    );
    const turn = await this.queryBus.execute<FindBotTurnQuery, BotTurnEntity>(
      new FindBotTurnQuery(scope, botId, turnId),
    );
    return this.mapper.toResponse(turn);
  }
}
