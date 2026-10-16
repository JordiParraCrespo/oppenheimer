import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotGroupMapper } from '../../bot-group.mapper';
import type { BotGroupEntity } from '../../domain/bot-group.entity';
import { BotGroupResponseDto } from '../../dtos/bot-group.response.dto';
import { FindBotGroupsQuery } from './find-bot-groups.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-groups')
export class FindBotGroupsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotGroupMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({ summary: 'List the sidebar’s bot groups', description: 'In sidebar order.' })
  @ApiResponse({ status: 200, type: [BotGroupResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<BotGroupResponseDto[]> {
    const groups = await this.queryBus.execute<FindBotGroupsQuery, BotGroupEntity[]>(
      new FindBotGroupsQuery({ scope }),
    );
    return groups.map((group) => this.mapper.toResponse(group));
  }
}
