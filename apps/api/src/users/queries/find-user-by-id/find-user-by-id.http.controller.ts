import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { AbilityRequest } from '../../../roles/application/ability.factory';
import { assertCanAccessUser } from '../../application/user-access.policy';
import type { UserEntity } from '../../domain/user.entity';
import { UserResponseDto } from '../../dtos/user.response.dto';
import { UserMapper } from '../../user.mapper';
import { FindUserByIdQuery } from './find-user-by-id.query';

@ApiTags('Users')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('users')
export class FindUserByIdHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: UserMapper,
  ) {}

  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'User' })
  @RequireScopes('users:read')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'User not found',
    code: 'USER_001',
  })
  async findOne(
    @Req() request: AbilityRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.queryBus.execute<FindUserByIdQuery, UserEntity>(
      new FindUserByIdQuery(id),
    );

    // `PoliciesGuard` only checked action + subject; the default role's rule is
    // scoped to `{ id: '${user.id}' }`, and that condition can only be tested
    // once the row is loaded. Admins hold `manage all` and pass unconditionally.
    assertCanAccessUser(request, 'read', user);

    return this.mapper.toResponse(user);
  }
}
