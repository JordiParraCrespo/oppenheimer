import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectResponseDto } from '../../dtos/project.response.dto';
import { ProjectMapper } from '../../project.mapper';
import { FindProjectsQuery } from './find-projects.query';
import { FindProjectsRequest } from './find-projects.request.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('projects')
export class FindProjectsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ProjectMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Project' })
  @RequireScopes('projects:read')
  @ApiOperation({
    summary: 'List the projects in the caller’s workspace',
    description: 'Newest first. Archived projects are left out unless asked for.',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    enum: ['true', 'false'],
    description: 'Include archived projects (default: false).',
  })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindProjectsRequest,
  ): Promise<ProjectResponseDto[]> {
    const projects = await this.queryBus.execute<FindProjectsQuery, ProjectEntity[]>(
      new FindProjectsQuery({ scope, includeArchived: query.includeArchived }),
    );
    return projects.map((project) => this.mapper.toResponse(project));
  }
}
