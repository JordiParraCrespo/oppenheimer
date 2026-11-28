import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PutModelProviderCredentialRequest } from '../put-model-provider-credential/put-model-provider-credential.request.dto';
import { AddModelProviderKeyCommand } from './add-model-provider-key.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class AddModelProviderKeyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':provider/keys')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Add another key for a model provider',
    description:
      'Stored after the keys there. A call tries them in order and moves to the next when one runs out of credit. Sealed, and never returned.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 404, description: 'No such model provider', code: 'BOTS_012' })
  @ApiProblemResponse({
    status: 409,
    description: 'The provider holds as many keys as it can',
    code: 'BOTS_049',
  })
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
  async add(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
    @Body() body: PutModelProviderCredentialRequest,
  ): Promise<void> {
    await this.commandBus.execute<AddModelProviderKeyCommand, string>(
      new AddModelProviderKeyCommand({ scope, provider, apiKey: body.apiKey }),
    );
  }
}
