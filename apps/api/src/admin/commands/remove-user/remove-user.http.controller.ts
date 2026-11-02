import { Controller, Delete, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
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
import { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import { RemoveUserCommand } from './remove-user.command';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class RemoveUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('users/:id')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  removeUser(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminSuccessResponseDto> {
    return this.commandBus.execute<RemoveUserCommand, AdminSuccessResponseDto>(
      new RemoveUserCommand({ headers: req.headers, userId: id }),
    );
  }
}
