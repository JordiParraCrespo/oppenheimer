import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminSessionResponseDto } from '../../dtos/admin-user.response.dto';
import { ListUserSessionsQuery } from './list-user-sessions.query';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class ListUserSessionsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('users/:id/sessions')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({
    // Named explicitly because the default collides with the sessions module's
    // own `listSessions`, and the generated client resolves a collision by
    // suffixing a digit — which is how the console's work-session list ended up
    // being called `listSessions2`. This one lists *a user's* sign-in sessions.
    operationId: 'listUserSessions',
    summary: "List a user's sessions",
  })
  @ApiResponse({ status: 200, type: [AdminSessionResponseDto] })
  listSessions(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminSessionResponseDto[]> {
    return this.queryBus.execute<ListUserSessionsQuery, AdminSessionResponseDto[]>(
      new ListUserSessionsQuery({ headers: req.headers, userId: id }),
    );
  }
}
