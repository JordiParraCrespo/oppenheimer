import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotMapper } from '../../bot.mapper';
import type { BotEntity } from '../../domain/bot.entity';
import { BotResponseDto } from '../../dtos/bot.response.dto';
import { FindBotsQuery } from './find-bots.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'List the workspace’s bots',
    description: 'Every bot, ungrouped first, then by group and position: the Employees sidebar.',
  })
  @ApiResponse({ status: 200, type: [BotResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<BotResponseDto[]> {
    const bots = await this.queryBus.execute<FindBotsQuery, BotEntity[]>(
      new FindBotsQuery({ scope }),
    );
    return bots.map((bot) => this.mapper.toResponse(bot));
  }
}
