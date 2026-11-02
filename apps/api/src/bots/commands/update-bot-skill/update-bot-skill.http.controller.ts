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
import { BotSkillMapper } from '../../bot-skill.mapper';
import type { BotSkillEntity } from '../../domain/bot-skill.entity';
import { BotSkillResponseDto } from '../../dtos/bot-skill.response.dto';
import { FindBotSkillQuery } from '../../queries/find-bot-skill/find-bot-skill.query';
import { UpdateBotSkillCommand } from './update-bot-skill.command';
import { UpdateBotSkillRequest } from './update-bot-skill.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class UpdateBotSkillHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotSkillMapper,
  ) {}

  @Patch(':id/skills/:skillId')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({ summary: "Change a bot's skill" })
  @ApiResponse({ status: 200, type: BotSkillResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Skill not found', code: 'BOTS_038' })
  @ApiProblemResponse({ status: 409, description: 'The name is taken', code: 'BOTS_039' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('skillId', new ParseUUIDPipe()) skillId: string,
    @Body() body: UpdateBotSkillRequest,
  ): Promise<BotSkillResponseDto> {
    await this.commandBus.execute<UpdateBotSkillCommand, string>(
      new UpdateBotSkillCommand({ scope, botId, skillId, change: body }),
    );
    const skill = await this.queryBus.execute<FindBotSkillQuery, BotSkillEntity>(
      new FindBotSkillQuery({ scope, botId, skill: { id: skillId } }),
    );
    return this.mapper.toResponse(skill);
  }
}
