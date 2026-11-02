import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotMapper } from '../../bot.mapper';
import type { BotEntity } from '../../domain/bot.entity';
import { BotResponseDto } from '../../dtos/bot.response.dto';
import { FindBotQuery } from '../../queries/find-bot/find-bot.query';
import { UpdateBotCommand } from './update-bot.command';
import { UpdateBotRequest } from './update-bot.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class UpdateBotHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Edit a bot',
    description:
      'Profile, home host, model, effort, approval level, learning, and where it sits: a `position` places it at that index in its group, and a new `groupId` with none puts it last there.',
  })
  @ApiResponse({ status: 200, type: BotResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Bot group not found', code: 'BOTS_003' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 422,
    description: 'That model cannot run a bot',
    code: 'BOTS_010',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Body() body: UpdateBotRequest,
  ): Promise<BotResponseDto> {
    await this.commandBus.execute<UpdateBotCommand, string>(
      new UpdateBotCommand({ scope, botId, input: body }),
    );
    const bot = await this.queryBus.execute<FindBotQuery, BotEntity>(
      new FindBotQuery({ scope, botId }),
    );
    return this.mapper.toResponse(bot);
  }
}
