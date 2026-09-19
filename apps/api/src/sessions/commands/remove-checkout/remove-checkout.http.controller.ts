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
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { RemoveCheckoutCommand } from './remove-checkout.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class RemoveCheckoutHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Delete(':id/checkouts/:checkoutId')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    operationId: 'removeSessionCheckout',
    summary: 'Remove a repository from a session',
    description:
      'Removes the worktree on the host with the same refuse-on-unpushed-work posture as closing a session, then retires the checkout. The row is kept: the directory name it used is never reissued inside this session.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'No such checkout on this session',
    code: 'SESSIONS_003',
  })
  async remove(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checkoutId', ParseUUIDPipe) checkoutId: string,
  ): Promise<SessionResponseDto> {
    const session = await this.commandBus.execute<RemoveCheckoutCommand, WorkSessionEntity>(
      new RemoveCheckoutCommand({ scope, sessionId: id, checkoutId }),
    );
    return this.mapper.toResponse(session);
  }
}
