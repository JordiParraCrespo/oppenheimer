import {
  Controller,
  Delete,
  HttpCode,
  Param,
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
import { DeleteModelProviderCredentialCommand } from './delete-model-provider-credential.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class DeleteModelProviderCredentialHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':provider')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Forget the workspace's key for a model provider",
    description: 'Its bots cannot answer until a key is stored again.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'No such model provider', code: 'BOTS_012' })
  async delete(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
  ): Promise<void> {
    await this.commandBus.execute<DeleteModelProviderCredentialCommand, void>(
      new DeleteModelProviderCredentialCommand({ scope, provider }),
    );
  }
}
