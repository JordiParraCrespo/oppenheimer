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
import { BotGroupMapper } from '../../bot-group.mapper';
import type { BotGroupEntity } from '../../domain/bot-group.entity';
import { BotGroupResponseDto } from '../../dtos/bot-group.response.dto';
import { FindBotGroupQuery } from '../../queries/find-bot-group/find-bot-group.query';
import { UpdateBotGroupCommand } from './update-bot-group.command';
import { UpdateBotGroupRequest } from './update-bot-group.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-groups')
export class UpdateBotGroupHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotGroupMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Rename or move a bot group',
    description: 'A `position` places it at that index in the sidebar; the others close up.',
  })
  @ApiResponse({ status: 200, type: BotGroupResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot group not found', code: 'BOTS_003' })
  @ApiProblemResponse({
    status: 409,
    description: 'A group with that name already exists',
    code: 'BOTS_004',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) groupId: string,
    @Body() body: UpdateBotGroupRequest,
  ): Promise<BotGroupResponseDto> {
    await this.commandBus.execute<UpdateBotGroupCommand, string>(
      new UpdateBotGroupCommand({ scope, groupId, input: body }),
    );
    const group = await this.queryBus.execute<FindBotGroupQuery, BotGroupEntity>(
      new FindBotGroupQuery({ scope, groupId }),
    );
    return this.mapper.toResponse(group);
  }
}
