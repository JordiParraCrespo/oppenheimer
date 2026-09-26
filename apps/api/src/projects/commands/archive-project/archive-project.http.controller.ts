import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
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
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectResponseDto } from '../../dtos/project.response.dto';
import { ProjectMapper } from '../../project.mapper';
import { ArchiveProjectCommand } from './archive-project.command';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('projects')
export class ArchiveProjectHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: ProjectMapper,
  ) {}

  @Delete(':id')
  @Version('1')
  // `update Project`, not `delete`: nothing is deleted. The row outlives the
  // project so its slug is never reissued.
  @CheckPolicies({ action: 'update', subject: 'Project' })
  @RequireScopes('projects:write')
  @ApiOperation({
    operationId: 'archiveProject',
    summary: 'Archive a project',
    description:
      'Retires the project so no new session can be started in it. The row is kept for ever: its slug is a directory name on every host that held it, and a retired name is never reissued. Refuses while the project still has sessions that are not closed.',
  })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Project not found', code: 'PROJECTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The project still has open sessions',
    code: 'PROJECTS_005',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Nothing can answer whether the project still has open sessions',
    code: 'PROJECTS_003',
  })
  async archive(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.commandBus.execute<ArchiveProjectCommand, ProjectEntity>(
      new ArchiveProjectCommand({ scope, projectId: id }),
    );
    return this.mapper.toResponse(project);
  }
}
