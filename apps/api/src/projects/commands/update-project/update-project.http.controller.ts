import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectResponseDto } from '../../dtos/project.response.dto';
import { ProjectMapper } from '../../project.mapper';
import { FindProjectQuery } from '../../queries/find-project/find-project.query';
import { UpdateProjectCommand } from './update-project.command';
import { UpdateProjectRequest } from './update-project.request.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('projects')
export class UpdateProjectHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: ProjectMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Project' })
  @RequireScopes('projects:write')
  @ApiOperation({
    summary: 'Rename a project',
    description:
      'The name is display-only. The slug is the project’s directory name on every host that holds it and cannot be changed.',
  })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Project not found', code: 'PROJECTS_001' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectRequest,
  ): Promise<ProjectResponseDto> {
    const projectId = await this.commandBus.execute<UpdateProjectCommand, AggregateID>(
      new UpdateProjectCommand({ scope, projectId: id, name: body.name }),
    );

    // Commands return only the aggregate id; the DTO comes from a follow-up
    // query, which re-applies the caller's scope.
    const project = await this.queryBus.execute<FindProjectQuery, ProjectEntity>(
      new FindProjectQuery({ scope, projectId }),
    );
    return this.mapper.toResponse(project);
  }
}
