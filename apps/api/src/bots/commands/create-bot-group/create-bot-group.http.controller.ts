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
import { BotGroupMapper } from '../../bot-group.mapper';
import type { BotGroupEntity } from '../../domain/bot-group.entity';
import { BotGroupResponseDto } from '../../dtos/bot-group.response.dto';
import { FindBotGroupQuery } from '../../queries/find-bot-group/find-bot-group.query';
import { CreateBotGroupCommand } from './create-bot-group.command';
import { CreateBotGroupRequest } from './create-bot-group.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-groups')
export class CreateBotGroupHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotGroupMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({ summary: 'Add a bot group', description: 'It goes last in the sidebar.' })
  @ApiResponse({ status: 201, type: BotGroupResponseDto })
  @ApiProblemResponse({
    status: 400,
    description: 'No active workspace',
    code: 'TENANT_001',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'A group with that name already exists',
    code: 'BOTS_004',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: CreateBotGroupRequest,
  ): Promise<BotGroupResponseDto> {
    const groupId = await this.commandBus.execute<CreateBotGroupCommand, string>(
      new CreateBotGroupCommand({ scope, input: body }),
    );
    const group = await this.queryBus.execute<FindBotGroupQuery, BotGroupEntity>(
      new FindBotGroupQuery({ scope, groupId }),
    );
    return this.mapper.toResponse(group);
  }
}
