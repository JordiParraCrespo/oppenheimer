import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { AbilityRequest } from '../../../roles/application/ability.factory';
import { assertCanAccessUser } from '../../application/user-access.policy';
import type { UserEntity } from '../../domain/user.entity';
import { UserResponseDto } from '../../dtos/user.response.dto';
import { FindUserByIdQuery } from '../../queries/find-user-by-id/find-user-by-id.query';
import { UserMapper } from '../../user.mapper';
import { UpdateUserCommand } from './update-user.command';
import { UpdateUserRequest } from './update-user.request.dto';

@ApiTags('Users')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('users')
export class UpdateUserHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: UserMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'User' })
  @RequireScopes('users:write')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'User not found',
    code: 'USER_001',
  })
  async update(
    @Req() request: AbilityRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRequest,
  ): Promise<UserResponseDto> {
    // Load before writing. `PoliciesGuard` cleared "may update *a* User", but
    // the default role's rule is scoped to `{ id: '${user.id}' }` and only the
    // loaded row can answer that. Checking after the command would authorize a
    // write that had already happened.
    const target = await this.queryBus.execute<FindUserByIdQuery, UserEntity>(
      new FindUserByIdQuery(id),
    );
    assertCanAccessUser(request, 'update', target);

    const userId = await this.commandBus.execute<UpdateUserCommand, AggregateID>(
      new UpdateUserCommand({ userId: id, ...body }),
    );
    const user = await this.queryBus.execute<FindUserByIdQuery, UserEntity>(
      new FindUserByIdQuery(userId),
    );
    return this.mapper.toResponse(user);
  }
}
