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
import { SetUserRoleCommand } from './set-user-role.command';
import { SetUserRoleRequest } from './set-user-role.request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class SetUserRoleHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('users/:id/role')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Set a user's global role" })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async setRole(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetUserRoleRequest,
  ): Promise<AdminUserResponseDto> {
    await this.commandBus.execute<SetUserRoleCommand, AggregateID>(
      new SetUserRoleCommand({ headers: req.headers, userId: id, role: body.role }),
    );
    return this.queryBus.execute<GetUserQuery, AdminUserResponseDto>(
      new GetUserQuery({ headers: req.headers, userId: id }),
    );
  }
}
