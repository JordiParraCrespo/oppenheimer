import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import { GetUserQuery } from '../../queries/get-user/get-user.query';
import { CreateUserCommand } from './create-user.command';
import { AdminCreateUserRequest } from './create-user.request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class CreateUserHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('users')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Create a user' })
  @ApiResponse({ status: 201, type: AdminUserResponseDto })
  async createUser(
    @Req() req: Request,
    @Body() body: AdminCreateUserRequest,
  ): Promise<AdminUserResponseDto> {
    const userId = await this.commandBus.execute<CreateUserCommand, AggregateID>(
      new CreateUserCommand({ headers: req.headers, input: body }),
    );
    return this.queryBus.execute<GetUserQuery, AdminUserResponseDto>(
      new GetUserQuery({ headers: req.headers, userId }),
    );
  }
}
