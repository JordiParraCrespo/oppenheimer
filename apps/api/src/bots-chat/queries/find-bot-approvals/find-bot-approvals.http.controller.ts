import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { BOT_APPROVAL_STATUSES } from '@oppenheimer/shared';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotApprovalMapper } from '../../bot-approval.mapper';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { BotApprovalResponseDto } from '../../dtos/bot-approval.response.dto';
import { FindBotApprovalsQuery } from './find-bot-approvals.query';
import { FindBotApprovalsRequest } from './find-bot-approvals.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotApprovalsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotApprovalMapper,
  ) {}

  @Get(':id/approvals')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's approvals",
    description:
      'Its Needs input cards, newest first, at most 50: `?status=pending` is the one waiting for you (a bot has one at most).',
  })
  @ApiQuery({ name: 'status', required: false, enum: BOT_APPROVAL_STATUSES })
  @ApiResponse({ status: 200, type: BotApprovalResponseDto, isArray: true })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Query() query: FindBotApprovalsRequest,
  ): Promise<BotApprovalResponseDto[]> {
    const approvals = await this.queryBus.execute<FindBotApprovalsQuery, BotApprovalEntity[]>(
      new FindBotApprovalsQuery(scope, botId, query.status),
    );
    return approvals.map((approval) => this.mapper.toResponse(approval));
  }
}
