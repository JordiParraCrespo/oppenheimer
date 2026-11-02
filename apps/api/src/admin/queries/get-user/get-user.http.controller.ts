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
import { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import { GetUserQuery } from './get-user.query';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class GetUserHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('users/:id')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Get a user' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  getUser(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    return this.queryBus.execute<GetUserQuery, AdminUserResponseDto>(
      new GetUserQuery({ headers: req.headers, userId: id }),
    );
  }
}
