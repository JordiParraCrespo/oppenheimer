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
import { BanUserCommand } from './ban-user.command';
import { BanUserRequest } from './ban-user.request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class BanUserHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('users/:id/ban')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Ban a user' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async ban(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BanUserRequest,
  ): Promise<AdminUserResponseDto> {
    await this.commandBus.execute<BanUserCommand, AggregateID>(
      new BanUserCommand({
        headers: req.headers,
        userId: id,
        banReason: body.banReason,
        banExpiresIn: body.banExpiresIn,
      }),
    );
    return this.queryBus.execute<GetUserQuery, AdminUserResponseDto>(
      new GetUserQuery({ headers: req.headers, userId: id }),
    );
  }
}
