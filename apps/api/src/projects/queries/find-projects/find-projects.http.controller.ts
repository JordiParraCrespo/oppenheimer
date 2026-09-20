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
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectResponseDto } from '../../dtos/project.response.dto';
import { ProjectMapper } from '../../project.mapper';
import { FindProjectsQuery } from './find-projects.query';

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
    // Named explicitly: the generated client turns an operationId into a function
    // name, and `list` would collide with every other resource's listing.
    operationId: 'listProjects',
    summary: 'List the projects in the caller’s workspace',
    description: 'Newest first.',
  })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<ProjectResponseDto[]> {
    const projects = await this.queryBus.execute<FindProjectsQuery, ProjectEntity[]>(
      new FindProjectsQuery({ scope }),
    );
    return projects.map((project) => this.mapper.toResponse(project));
  }
}
