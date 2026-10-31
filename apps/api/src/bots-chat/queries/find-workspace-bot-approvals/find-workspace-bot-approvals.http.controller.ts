import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { BOT_APPROVAL_STATUSES, WORKSPACE_BOT_APPROVALS_MAX } from '@oppenheimer/shared';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotApprovalMapper } from '../../bot-approval.mapper';
import { WorkspaceBotApprovalResponseDto } from '../../dtos/workspace-bot-approval.response.dto';
import {
  FindWorkspaceBotApprovalsQuery,
  type WorkspaceBotApproval,
} from './find-workspace-bot-approvals.query';
import { FindWorkspaceBotApprovalsRequest } from './find-workspace-bot-approvals.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-approvals')
export class FindWorkspaceBotApprovalsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotApprovalMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "The workspace's bot approvals",
    description: `Every bot's Needs input cards in one status, newest first, at most ${WORKSPACE_BOT_APPROVALS_MAX}, with the bot's name: \`pending\` (the default) is what waits for you, at most one per bot.`,
  })
  @ApiQuery({ name: 'status', required: false, enum: BOT_APPROVAL_STATUSES })
  @ApiResponse({ status: 200, type: WorkspaceBotApprovalResponseDto, isArray: true })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindWorkspaceBotApprovalsRequest,
  ): Promise<WorkspaceBotApprovalResponseDto[]> {
    const found = await this.queryBus.execute<
      FindWorkspaceBotApprovalsQuery,
      WorkspaceBotApproval[]
    >(new FindWorkspaceBotApprovalsQuery(scope, query.status));
    return found.map(({ approval, botName }) => this.mapper.toWorkspaceResponse(approval, botName));
  }
}
