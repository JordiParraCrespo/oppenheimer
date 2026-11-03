import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { WORKSPACE_BOT_NOTICES_MAX } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotNoticeMapper } from '../../bot-notice.mapper';
import { WorkspaceBotNoticeResponseDto } from '../../dtos/workspace-bot-notice.response.dto';
import {
  FindWorkspaceBotNoticesQuery,
  type WorkspaceBotNotice,
} from './find-workspace-bot-notices.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-notices')
export class FindWorkspaceBotNoticesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotNoticeMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "The workspace's bot notices",
    description: `Each bot's latest line to the person (its \`notify\` tool), on the bots you may read, newest first, at most ${WORKSPACE_BOT_NOTICES_MAX}. A newer notice replaces a bot's last one under a new id.`,
  })
  @ApiResponse({ status: 200, type: WorkspaceBotNoticeResponseDto, isArray: true })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<WorkspaceBotNoticeResponseDto[]> {
    const found = await this.queryBus.execute<FindWorkspaceBotNoticesQuery, WorkspaceBotNotice[]>(
      new FindWorkspaceBotNoticesQuery(scope),
    );
    return found.map(({ notice, botName }) => this.mapper.toWorkspaceResponse(notice, botName));
  }
}
