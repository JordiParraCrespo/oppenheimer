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
      'A saved scope: the repositories its sessions usually work on, each with a base branch and whether it is offered by default, plus the host, agent and instructions a new session starts with. The defaults are offered, never applied. The slug is derived from the name once and never changes.',
  })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  @ApiProblemResponse({
    status: 400,
    description: 'The repository list is not one a project can hold',
    code: 'PROJECTS_006',
  })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
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
