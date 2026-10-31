import {
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { IDEMPOTENCY_KEY_MAX } from '@oppenheimer/shared';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { MilestoneWithProgress } from '../../database/milestone.repository.port';
import { userActor } from '../../domain/plan-change.types';
import { MilestoneResponseDto } from '../../dtos/milestone.response.dto';
import { MilestoneMapper } from '../../milestone.mapper';
import { FindMilestoneQuery } from '../../queries/find-milestone/find-milestone.query';
import { CreateMilestoneCommand } from './create-milestone.command';
import { CreateMilestoneRequest } from './create-milestone.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('milestones')
export class CreateMilestoneHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: MilestoneMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({ summary: 'Add a milestone to a project' })
  @ApiResponse({ status: 201, type: MilestoneResponseDto })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived or missing',
    code: 'TASKS_004',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Up to 128 characters. A retried request with the same key answers the row the first one made.',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: CreateMilestoneRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<MilestoneResponseDto> {
    const milestoneId = await this.commandBus.execute<CreateMilestoneCommand, string>(
      new CreateMilestoneCommand({
        scope,
        actor: userActor(userId),
        idempotencyKey: idempotencyKey?.trim().slice(0, IDEMPOTENCY_KEY_MAX) || null,
        userId,
        input: body,
      }),
    );
    const { milestone, progress } = await this.queryBus.execute<
      FindMilestoneQuery,
      MilestoneWithProgress
    >(new FindMilestoneQuery({ scope, milestoneId }));
    return this.mapper.toResponse(milestone, progress);
  }
}
