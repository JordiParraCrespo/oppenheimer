import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AppendedCloudTranscriptResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { AppendCloudTranscriptCommand } from './append-cloud-transcript.command';
import { AppendCloudTranscriptRequest } from './append-cloud-transcript.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class AppendCloudTranscriptHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-transcript')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('cloud-chat:write')
  // A hook posts as the agent writes, in batches, a few times a second at most.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send lines of a Claude Code cloud session’s transcript',
    description:
      'What the SessionStart hook in a Claude Code cloud session sends: its transcript lines from `from` on, each as Claude Code wrote it. They become the session’s chat in the console. Only a cloud session this workspace launched keeps one. Lines are numbered, so sending a batch again stores nothing twice.',
  })
  @ApiOkResponse({ type: AppendedCloudTranscriptResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'No cloud session of this workspace has that id',
    code: 'SESSIONS_053',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async append(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: AppendCloudTranscriptRequest,
  ): Promise<AppendedCloudTranscriptResponseDto> {
    const accepted = await this.commandBus.execute<AppendCloudTranscriptCommand, number>(
      new AppendCloudTranscriptCommand({
        scope,
        cloudSessionId: body.cloudSessionId,
        from: body.from,
        lines: body.lines,
      }),
    );
    return { accepted };
  }
}
