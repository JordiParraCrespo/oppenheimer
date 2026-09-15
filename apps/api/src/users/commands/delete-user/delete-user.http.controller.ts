import { Controller, Delete, Param, ParseUUIDPipe, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { DeleteUserCommand } from './delete-user.command';

@ApiTags('Users')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('users')
export class DeleteUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @CheckPolicies({ action: 'delete', subject: 'User' })
  @RequireScopes('users:write')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200 })
  @ApiProblemResponse({ status: 404, description: 'User not found', code: 'USER_001' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.commandBus.execute<DeleteUserCommand, void>(new DeleteUserCommand({ userId: id }));
  }
}
