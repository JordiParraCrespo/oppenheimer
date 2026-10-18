import {
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
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SetDefaultModelProviderCommand } from './set-default-model-provider.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class SetDefaultModelProviderHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':provider/default')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Make a model provider the one new bots start on',
    description:
      'Only a provider the workspace has a key for. Bots already made keep their provider; a bot created naming none starts on this one, at its default model.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({
    status: 400,
    description: 'Bots belong to an organization',
    code: 'BOTS_002',
  })
  @ApiProblemResponse({ status: 404, description: 'No such model provider', code: 'BOTS_012' })
  @ApiProblemResponse({
    status: 409,
    description: 'That model provider has no key',
    code: 'BOTS_023',
  })
  async setDefault(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
  ): Promise<void> {
    await this.commandBus.execute<SetDefaultModelProviderCommand, void>(
      new SetDefaultModelProviderCommand({ scope, provider }),
    );
  }
}
