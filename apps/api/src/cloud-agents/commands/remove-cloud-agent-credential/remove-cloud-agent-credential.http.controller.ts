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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CloudAgentProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import { RemoveCloudAgentCredentialCommand } from './remove-cloud-agent-credential.command';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class RemoveCloudAgentCredentialHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('providers/:provider/credential')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:write')
  @ApiOperation({
    summary: 'Disconnect a cloud agent vendor',
    description:
      'Forgets the caller’s key for the vendor. Their agents stay listed as last heard of, and keep running at the vendor. No key stored does nothing.',
  })
  @ApiParam({ name: 'provider', enum: ['cursor'] })
  @ApiResponse({ status: 204 })
  @CloudAgentProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such provider', code: 'CLOUD_AGENTS_011' })
  async remove(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
  ): Promise<void> {
    await this.commandBus.execute(new RemoveCloudAgentCredentialCommand({ scope, provider }));
  }
}
