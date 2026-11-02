import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { DeleteBotGroupCommand } from './delete-bot-group.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-groups')
export class DeleteBotGroupHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Delete a bot group',
    description: 'Its bots stay, ungrouped, after the bots already there.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Bot group not found', code: 'BOTS_003' })
  async delete(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) groupId: string,
  ): Promise<void> {
    await this.commandBus.execute<DeleteBotGroupCommand, string>(
      new DeleteBotGroupCommand({ scope, groupId }),
    );
  }
}
