import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { ModelProviderCredentialEntity } from '../../domain/model-provider-credential.entity';
import { ModelProviderCredentialResponseDto } from '../../dtos/model-provider-credential.response.dto';
import { ModelProviderCredentialMapper } from '../../model-provider-credential.mapper';
import { FindModelProviderCredentialsQuery } from './find-model-provider-credentials.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class FindModelProviderCredentialsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ModelProviderCredentialMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "The workspace's model providers",
    description:
      'Every provider a bot can run on, in catalog order, each saying whether the workspace has a key for it and the key’s last four characters. Never the key.',
  })
  @ApiResponse({ status: 200, type: ModelProviderCredentialResponseDto, isArray: true })
  async findAll(
    @CurrentAccessScope() scope: AccessScope,
  ): Promise<ModelProviderCredentialResponseDto[]> {
    const stored = await this.queryBus.execute<
      FindModelProviderCredentialsQuery,
      ModelProviderCredentialEntity[]
    >(new FindModelProviderCredentialsQuery(scope));
    return this.mapper.toResponseList(stored);
  }
}
