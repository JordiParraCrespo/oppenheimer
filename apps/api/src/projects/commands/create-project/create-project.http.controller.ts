import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
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
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectResponseDto } from '../../dtos/project.response.dto';
import { ProjectMapper } from '../../project.mapper';
import { CreateProjectCommand } from './create-project.command';
import { CreateProjectRequest } from './create-project.request.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('projects')
export class CreateProjectHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: ProjectMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Project' })
  @RequireScopes('projects:write')
  @ApiOperation({
    operationId: 'createProject',
    summary: 'Create a project',
    description:
      'A body of work with a name, the repositories it holds (each saying whether every new session clones it, and what it branches from), and the host and agent New session picks first. The directory name is derived from the first default repository, else the first repository, else the name, and never changes. A project made here has no origin repository: the one a first session creates for a repository is found by GitHub’s id, this one by its own.',
  })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'GitHub installation not found',
    code: 'GITHUB_001',
  })
  @ApiProblemResponse({
    status: 404,
    description: 'That repository is not one this GitHub installation covers',
    code: 'GITHUB_010',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'That name is a directory another project already holds',
    code: 'PROJECTS_006',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: CreateProjectRequest,
  ): Promise<ProjectResponseDto> {
    const project = await this.commandBus.execute<CreateProjectCommand, ProjectEntity>(
      new CreateProjectCommand({ scope, input: body }),
    );
    return this.mapper.toResponse(project);
  }
}
