import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PersonMemoryResponseDto } from '../../dtos/person-memory.response.dto';
import { PersonMemoryMapper } from '../../person-memory.mapper';
import { FindPersonMemoryQuery, type PersonMemory } from './find-person-memory.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-memory')
export class FindPersonMemoryHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: PersonMemoryMapper,
  ) {}

  @Get('person')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'Read what your bots know about you',
    description:
      'What you wrote about yourself, and every fact about you that a bot of yours keeps, newest first.',
  })
  @ApiResponse({ status: 200, type: PersonMemoryResponseDto })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<PersonMemoryResponseDto> {
    const memory = await this.queryBus.execute<FindPersonMemoryQuery, PersonMemory>(
      new FindPersonMemoryQuery({ scope }),
    );
    return this.mapper.toMemoryResponse(memory);
  }
}
