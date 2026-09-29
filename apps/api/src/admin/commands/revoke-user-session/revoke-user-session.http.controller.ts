import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import { RevokeUserSessionCommand } from './revoke-user-session.command';
import { RevokeSessionRequest } from './revoke-user-session.request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class RevokeUserSessionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('users/:id/sessions/revoke')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Revoke one of a user's sessions by id" })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Session not found',
    code: 'ADMIN_009',
  })
  revokeSession(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevokeSessionRequest,
  ): Promise<AdminSuccessResponseDto> {
    return this.commandBus.execute<RevokeUserSessionCommand, AdminSuccessResponseDto>(
      new RevokeUserSessionCommand({ headers: req.headers, userId: id, sessionId: body.sessionId }),
    );
  }
}
