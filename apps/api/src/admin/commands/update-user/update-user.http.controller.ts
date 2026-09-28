import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
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
import { UpdateUserCommand } from './update-user.command';
import { AdminUpdateUserRequest } from './update-user.request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class UpdateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch('users/:id')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Update a user's profile fields" })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  updateUser(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminUpdateUserRequest,
  ): Promise<AdminUserResponseDto> {
    return this.commandBus.execute<UpdateUserCommand, AdminUserResponseDto>(
      new UpdateUserCommand({ headers: req.headers, userId: id, data: body }),
    );
  }
}
