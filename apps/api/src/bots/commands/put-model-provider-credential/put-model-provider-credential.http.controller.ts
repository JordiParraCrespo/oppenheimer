import {
  Body,
  Controller,
  HttpCode,
  Param,
  Put,
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
import { PutModelProviderCredentialCommand } from './put-model-provider-credential.command';
import { PutModelProviderCredentialRequest } from './put-model-provider-credential.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class PutModelProviderCredentialHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':provider')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Store the workspace's key for a model provider",
    description:
      'Sealed before it is stored, replacing the key there. It is never returned: the list answers only whether there is one and its last four characters.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({
    status: 400,
    description: 'No active workspace',
    code: 'TENANT_001',
  })
  @ApiProblemResponse({ status: 404, description: 'No such model provider', code: 'BOTS_012' })
  @ApiProblemResponse({
    status: 422,
    description: 'ChatGPT connects by signing in, not with a key',
    code: 'BOTS_017',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Model providers are not configured on this server',
    code: 'BOTS_011',
  })
  async put(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
    @Body() body: PutModelProviderCredentialRequest,
  ): Promise<void> {
    await this.commandBus.execute<PutModelProviderCredentialCommand, string>(
      new PutModelProviderCredentialCommand({ scope, provider, apiKey: body.apiKey }),
    );
  }
}
