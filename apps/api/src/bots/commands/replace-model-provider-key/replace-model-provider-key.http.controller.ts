import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
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
import { ReplaceModelProviderKeyCommand } from './replace-model-provider-key.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class ReplaceModelProviderKeyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':provider/keys/:keyId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Replace one of a model provider's keys",
    description:
      'In its place among the others, and no longer marked out of credit. Sealed, and never returned.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 404, description: 'No such model provider', code: 'BOTS_012' })
  @ApiProblemResponse({ status: 404, description: 'Provider key not found', code: 'BOTS_050' })
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
  async replace(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
    @Param('keyId', new ParseUUIDPipe()) keyId: string,
    @Body() body: PutModelProviderCredentialRequest,
  ): Promise<void> {
    await this.commandBus.execute<ReplaceModelProviderKeyCommand, string>(
      new ReplaceModelProviderKeyCommand({ scope, provider, keyId, apiKey: body.apiKey }),
    );
  }
}
