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
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { MilestoneWithProgress } from '../../database/milestone.repository.port';
import { MilestoneResponseDto } from '../../dtos/milestone.response.dto';
import { MilestoneMapper } from '../../milestone.mapper';
import { FindMilestoneQuery } from '../../queries/find-milestone/find-milestone.query';
import { UpdateMilestoneCommand } from './update-milestone.command';
import { UpdateMilestoneRequest } from './update-milestone.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('milestones')
export class UpdateMilestoneHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: MilestoneMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Change a milestone',
    description: 'Its name, target date or project. Moving it to another project moves its tasks.',
  })
  @ApiResponse({ status: 200, type: MilestoneResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Milestone not found', code: 'TASKS_002' })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived or missing',
    code: 'TASKS_004',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMilestoneRequest,
  ): Promise<MilestoneResponseDto> {
    await this.commandBus.execute(
      new UpdateMilestoneCommand({ scope, milestoneId: id, changes: body }),
    );
    const { milestone, progress } = await this.queryBus.execute<
      FindMilestoneQuery,
      MilestoneWithProgress
    >(new FindMilestoneQuery({ scope, milestoneId: id }));
    return this.mapper.toResponse(milestone, progress);
  }
}
