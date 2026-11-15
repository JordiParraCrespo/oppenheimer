import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
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
import { CreateBotCommand } from './create-bot.command';
import { CreateBotRequest } from './create-bot.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class CreateBotHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Create a bot',
    description:
      'A blank bot: the next free first name ("Juno", "Milo"…) unless named, a given name numbered when the workspace has it, last in its group, with a soul that says its name and empty instructions.',
  })
  @ApiResponse({ status: 201, type: BotResponseDto })
  @ApiProblemResponse({
    status: 400,
    description: 'No active workspace',
    code: 'TENANT_001',
  })
  @ApiProblemResponse({ status: 404, description: 'Bot group not found', code: 'BOTS_003' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: CreateBotRequest,
  ): Promise<BotResponseDto> {
    const botId = await this.commandBus.execute<CreateBotCommand, string>(
      new CreateBotCommand({ scope, input: body }),
    );
    const bot = await this.queryBus.execute<FindBotQuery, BotEntity>(
      new FindBotQuery({ scope, botId }),
    );
    return this.mapper.toResponse(bot);
  }
}
