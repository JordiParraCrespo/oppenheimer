import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectResponseDto } from '../../dtos/project.response.dto';
import { ProjectMapper } from '../../project.mapper';
import { FindProjectQuery } from './find-project.query';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('projects')
export class FindProjectHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ProjectMapper,
  ) {}

  /**
   * The list and the detail read through the same scoped query, so a project in
   * another workspace is not found by either.
   */
  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Project' })
  @RequireScopes('projects:read')
  @ApiOperation({ summary: 'Get one project' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Project not found', code: 'PROJECTS_001' })
  async get(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.queryBus.execute<FindProjectQuery, ProjectEntity>(
      new FindProjectQuery({ scope, projectId: id }),
    );
    return this.mapper.toResponse(project);
  }
}
