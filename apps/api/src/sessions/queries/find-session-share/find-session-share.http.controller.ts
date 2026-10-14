import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SessionShareStateResponseDto } from '../../dtos/session-share.response.dto';
import { SessionShareMapper } from '../../session-share.mapper';
import { FindSessionShareQuery, type FoundSessionShare } from './find-session-share.query';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionShareHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: SessionShareMapper,
  ) {}

  @Get(':id/share')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @ApiOperation({
    summary: 'How this session is shared',
    description:
      'Its address, who may open it, what they may do and until when; `null` if it is not shared.',
  })
  @ApiResponse({ status: 200, type: SessionShareStateResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionShareStateResponseDto> {
    const found = await this.queryBus.execute<FindSessionShareQuery, FoundSessionShare | null>(
      new FindSessionShareQuery({ scope, sessionId: id }),
    );
    return { share: found ? this.mapper.toResponse(found.share, found.owner) : null };
  }
}
