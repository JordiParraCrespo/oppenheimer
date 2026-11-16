import {
  Body,
  Controller,
  DefaultValuePipe,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import {
  type OpenedSessionWindowResponse,
  type OpenSessionWindowBody,
  openSessionWindowBodySchema,
} from '@oppenheimer/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { OpenedSessionWindowResponseDto } from '../../dtos/session.response.dto';
import { OpenSessionWindowCommand } from './open-session-window.command';
import { OpenSessionWindowRequest } from './open-session-window.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class OpenSessionWindowHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/windows')
  @Version('1')
  // A shell on the session's host is a terminal: `update Session`, like an attach ticket.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Open a terminal in a session',
    description:
      "Opens a plain shell in the session's worktree, a new tmux window on its host, and answers with its index (mint an attach ticket for that `window` to stream it) and every window after it. With `agent`, that coding agent is started in the new window instead, at the session's permission level, with the session's model and effort only when it is the session's own agent; the window is named after it. Window 0 stays the session's agent. The body is optional: without one the window is a plain shell.",
  })
  @ApiBody({ type: OpenSessionWindowRequest, required: false })
  @ApiResponse({ status: 201, type: OpenedSessionWindowResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 409,
    description: "This host's runner cannot open or close a session's terminals",
    code: 'SESSIONS_056',
  })
  @ApiProblemResponse({
    status: 409,
    description: "The host refused to change the session's terminals",
    code: 'SESSIONS_059',
  })
  @ApiProblemResponse({
    status: 409,
    description: "This host's runner cannot start a second agent in a session",
    code: 'SESSIONS_060',
  })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async open(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    // Validated here rather than by the global pipe: a POST with no body at
    // all is a plain shell, as it was before the body existed.
    @Body(new DefaultValuePipe({}), new ZodValidationPipe(openSessionWindowBodySchema))
    body: OpenSessionWindowBody,
  ): Promise<OpenedSessionWindowResponseDto> {
    return this.commandBus.execute<OpenSessionWindowCommand, OpenedSessionWindowResponse>(
      new OpenSessionWindowCommand({ scope, sessionId: id, agent: body.agent }),
    );
  }
}
