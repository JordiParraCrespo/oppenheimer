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
import { BotSkillMapper } from '../../bot-skill.mapper';
import type { BotSkillEntity } from '../../domain/bot-skill.entity';
import { BotSkillResponseDto } from '../../dtos/bot-skill.response.dto';
import { FindBotSkillsQuery } from './find-bot-skills.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotSkillsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotSkillMapper,
  ) {}

  @Get(':id/skills')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({ summary: "Read a bot's skills", description: 'By name.' })
  @ApiResponse({ status: 200, type: [BotSkillResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotSkillResponseDto[]> {
    const skills = await this.queryBus.execute<FindBotSkillsQuery, BotSkillEntity[]>(
      new FindBotSkillsQuery({ scope, botId }),
    );
    return skills.map((skill) => this.mapper.toResponse(skill));
  }
}
