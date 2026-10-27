import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { SessionPreviewResponseDto } from '../../dtos/session.response.dto';
import { IssueSessionPreviewCommand } from './issue-session-preview.command';
import type { IssuedSessionPreview } from './issue-session-preview.command-handler';
import { IssueSessionPreviewRequest } from './issue-session-preview.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class IssueSessionPreviewHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/previews')
  @Version('1')
  // Using the session's running app is using the session, as a terminal is.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @RequireFlag('session_browser_preview')
  // One per Reload and per Open in a new tab.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: "Open one of a session's ports in a preview",
    description:
      "A URL on the port's own preview origin carrying a single-use ticket (60 seconds). The origin redeems it, keeps the reader in a cookie of its own, and serves the session's dev server through its host's runner, as if from `localhost:<port>`. Judged again at redemption and every minute after, as a terminal is.",
  })
  @ApiResponse({ status: 201, type: SessionPreviewResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 501,
    description: 'Previews are not configured',
    code: 'SESSIONS_032',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'A ticket could not be issued',
    code: 'SESSIONS_008',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async issue(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: IssueSessionPreviewRequest,
  ): Promise<SessionPreviewResponseDto> {
    return this.commandBus.execute<IssueSessionPreviewCommand, IssuedSessionPreview>(
      new IssueSessionPreviewCommand({
        scope,
        sessionId: id,
        userId,
        port: body.port,
        path: body.path,
        embed: body.embed ?? false,
      }),
    );
  }
}
