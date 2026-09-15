import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AccessGrantMapper } from '../../authz.mapper';
import { CurrentAccessScope } from '../../decorators/current-access-scope.decorator';
import type { AccessGrantEntity } from '../../domain/access-grant.entity';
import { AccessGrantResponseDto } from '../../dtos/access-grant.response.dto';
import { AccessScopeInterceptor } from '../../interceptors/access-scope.interceptor';
import { FindAccessGrantsQuery } from '../../queries/find-access-grants/find-access-grants.query';
import { CreateAccessGrantCommand } from './create-access-grant.command';
import { CreateAccessGrantRequest } from './create-access-grant.request.dto';

@ApiTags('Access grants')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('access-grants')
export class CreateAccessGrantHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AccessGrantMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Role' })
  @RequireScopes('roles:write')
  @ApiOperation({
    summary: 'Grant access to specific records',
    description:
      'The grant may not exceed the granter’s own access. Omitting resourceId grants every resource of that type, which requires already holding all of them.',
  })
  @ApiResponse({ status: 201, type: AccessGrantResponseDto })
  @ApiProblemResponse({
    status: 403,
    description: "An access grant cannot exceed the granter's own access",
    code: 'GRANT_002',
  })
  @ApiProblemResponse({
    status: 400,
    description: 'The named principal does not belong to this organization',
    code: 'GRANT_003',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: CreateAccessGrantRequest,
  ): Promise<AccessGrantResponseDto> {
    const grantId = await this.commandBus.execute<CreateAccessGrantCommand, AggregateID>(
      new CreateAccessGrantCommand({ ...body, scope }),
    );

    // Commands return only the aggregate id; read the row back for the DTO.
    const grants = await this.queryBus.execute<FindAccessGrantsQuery, AccessGrantEntity[]>(
      new FindAccessGrantsQuery({ scope }),
    );
    const created = grants.find((grant) => grant.id === grantId);
    return this.mapper.toResponse(created ?? grants[0]);
  }
}
