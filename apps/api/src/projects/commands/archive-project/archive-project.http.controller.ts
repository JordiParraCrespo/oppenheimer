import {
  Controller,
  Delete,
  HttpCode,
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
import { ArchiveProjectCommand } from './archive-project.command';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('projects')
export class ArchiveProjectHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Project' })
  @RequireScopes('projects:write')
  @ApiOperation({
    summary: 'Archive a project',
    description:
      'The row is kept: its slug is a directory name on every host that held the project, and retiring it for good is what stops a later project inheriting that directory. Refused while the project has open sessions.',
  })
  @ApiResponse({ status: 204, description: 'Project archived' })
  @ApiProblemResponse({ status: 404, description: 'Project not found', code: 'PROJECTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The project still has open sessions',
    code: 'PROJECTS_002',
  })
  async archive(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new ArchiveProjectCommand({ scope, projectId: id }));
  }
}
