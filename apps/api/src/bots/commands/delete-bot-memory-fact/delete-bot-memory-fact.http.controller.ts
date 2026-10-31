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
import { DeleteBotMemoryFactCommand } from './delete-bot-memory-fact.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class DeleteBotMemoryFactHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id/memory/:factId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({ summary: 'Make a bot forget a fact' })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Memory fact not found', code: 'BOTS_008' })
  async delete(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('factId', new ParseUUIDPipe()) factId: string,
  ): Promise<void> {
    await this.commandBus.execute<DeleteBotMemoryFactCommand, string>(
      new DeleteBotMemoryFactCommand({ scope, botId, factId }),
    );
  }
}
