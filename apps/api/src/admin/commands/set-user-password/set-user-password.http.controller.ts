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
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import { SetUserPasswordCommand } from './set-user-password.command';
import { SetUserPasswordRequest } from './set-user-password.request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class SetUserPasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('users/:id/set-password')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Set a user's password" })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  setPassword(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetUserPasswordRequest,
  ): Promise<AdminSuccessResponseDto> {
    return this.commandBus.execute<SetUserPasswordCommand, AdminSuccessResponseDto>(
      new SetUserPasswordCommand({
        headers: req.headers,
        userId: id,
        newPassword: body.newPassword,
      }),
    );
  }
}
