import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request, Response } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { IssuedSession } from '../../infrastructure/admin-auth.port';
import { ImpersonateUserCommand } from './impersonate-user.command';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class ImpersonateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('users/:id/impersonate')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({
    summary: 'Impersonate a user (issues an impersonation session)',
  })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async impersonate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    const { user, cookies } = await this.commandBus.execute<ImpersonateUserCommand, IssuedSession>(
      new ImpersonateUserCommand({ headers: req.headers, userId: id }),
    );
    // Better Auth issued a session for the caller; the browser only moves onto
    // it if it stores the cookie.
    if (cookies.length > 0) res.setHeader('set-cookie', cookies);
    return user;
  }
}
