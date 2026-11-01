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
import { CreateBotSkillCommand } from './create-bot-skill.command';
import { CreateBotSkillRequest } from './create-bot-skill.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class CreateBotSkillHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotSkillMapper,
  ) {}

  @Post(':id/skills')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Give a bot a skill',
    description: 'A reusable way of doing one task, run as /<name> or by the bot when it fits.',
  })
  @ApiResponse({ status: 201, type: BotSkillResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 409, description: 'The name is taken', code: 'BOTS_039' })
  @ApiProblemResponse({
    status: 422,
    description: 'The bot has as many skills as it can keep',
    code: 'BOTS_040',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Body() body: CreateBotSkillRequest,
  ): Promise<BotSkillResponseDto> {
    const skillId = await this.commandBus.execute<CreateBotSkillCommand, string>(
      new CreateBotSkillCommand({ scope, botId, ...body }),
    );
    const skill = await this.queryBus.execute<FindBotSkillQuery, BotSkillEntity>(
      new FindBotSkillQuery({ scope, botId, skill: { id: skillId } }),
    );
    return this.mapper.toResponse(skill);
  }
}
