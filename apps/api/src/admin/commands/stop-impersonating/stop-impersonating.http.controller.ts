import { Controller, Post, Req, Res, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request, Response } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { IssuedSession } from '../../infrastructure/admin-auth.port';
import { StopImpersonatingCommand } from './stop-impersonating.command';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class StopImpersonatingHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('stop-impersonating')
  @NoPolicy('ends the caller’s own impersonation session; holding no admin power is the point')
  @Version('1')
  @RequireScopes('admin:write')
  @ApiOperation({ summary: 'Stop impersonating and restore the admin session' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async stopImpersonating(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminUserResponseDto> {
    const { user, cookies } = await this.commandBus.execute<
      StopImpersonatingCommand,
      IssuedSession
    >(new StopImpersonatingCommand({ headers: req.headers }));
    if (cookies.length > 0) res.setHeader('set-cookie', cookies);
    return user;
  }
}
