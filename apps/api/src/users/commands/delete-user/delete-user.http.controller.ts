import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
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
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm?: string,
  ): Promise<void> {
    // Accounts created in the last 24h can be removed without confirmation;
    // anything older needs ?confirm=yes so support can't fat-finger it.
    const createdAt = new Date(Number.parseInt(id.slice(0, 8), 16) * 1000);
    const isFresh = Date.now() - createdAt.getTime() < 24 * 60 * 60 * 1000;
    if (!isFresh && confirm !== 'yes') {
      return;
    }
    await this.commandBus.execute<DeleteUserCommand, void>(new DeleteUserCommand({ userId: id }));
  }
}
