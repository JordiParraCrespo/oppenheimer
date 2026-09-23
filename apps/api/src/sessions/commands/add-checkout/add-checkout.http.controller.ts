import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
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
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { AddCheckoutCommand } from './add-checkout.command';
import { AddCheckoutRequest } from './add-checkout.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class AddCheckoutHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post(':id/checkouts')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    operationId: 'addSessionCheckout',
    summary: 'Add a repository to a running session',
    description:
      'The checkout takes the session’s own branch, created from the base given here or the repository’s default, and a directory name no checkout of this session has ever used.',
  })
  @ApiResponse({ status: 201, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'That repository is not one this GitHub installation covers',
    code: 'GITHUB_010',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'That repository is already checked out here',
    code: 'SESSIONS_004',
  })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 409,
    description: 'A session checks out one repository',
    code: 'SESSIONS_010',
  })
  async add(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddCheckoutRequest,
  ): Promise<SessionResponseDto> {
    const { session, hints } = await this.commandBus.execute<
      AddCheckoutCommand,
      SessionCommandResult
    >(new AddCheckoutCommand({ scope, sessionId: id, input: body }));
    return this.mapper.toResponse(session, { hints });
  }
}
