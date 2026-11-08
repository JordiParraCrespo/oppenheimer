import { Body, Controller, Put, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PersonAboutResponseDto } from '../../dtos/person-memory.response.dto';
import { PersonMemoryMapper } from '../../person-memory.mapper';
import {
  FindPersonMemoryQuery,
  type PersonMemory,
} from '../../queries/find-person-memory/find-person-memory.query';
import { UpdatePersonAboutCommand } from './update-person-about.command';
import { UpdatePersonAboutRequest } from './update-person-about.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-memory')
export class UpdatePersonAboutHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: PersonMemoryMapper,
  ) {}

  @Put('person/about')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Write what your bots know about you',
    description:
      'In the system prompt of every bot you made in the workspace. Your bots read it and never change it; an empty text clears it.',
  })
  @ApiResponse({ status: 200, type: PersonAboutResponseDto })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: UpdatePersonAboutRequest,
  ): Promise<PersonAboutResponseDto> {
    await this.commandBus.execute<UpdatePersonAboutCommand, string>(
      new UpdatePersonAboutCommand({ scope, about: body.about }),
    );
    const memory = await this.queryBus.execute<FindPersonMemoryQuery, PersonMemory>(
      new FindPersonMemoryQuery({ scope }),
    );
    return this.mapper.toResponse(memory.about);
  }
}
