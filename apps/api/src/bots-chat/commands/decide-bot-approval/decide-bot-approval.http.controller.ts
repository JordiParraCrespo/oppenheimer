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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { namedBotApprovalDecision } from '@oppenheimer/shared';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotApprovalMapper } from '../../bot-approval.mapper';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { BotApprovalResponseDto } from '../../dtos/bot-approval.response.dto';
import { FindBotApprovalQuery } from '../../queries/find-bot-approval/find-bot-approval.query';
import { DecideBotApprovalCommand } from './decide-bot-approval.command';
import { DecideBotApprovalRequest } from './decide-bot-approval.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class DecideBotApprovalHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotApprovalMapper,
  ) {}

  @Post(':id/approvals/:approvalId/decision')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Answer a bot's Needs input card",
    description:
      "`decision` is one of the card's `availableDecisions`. `approve` queues exactly the call the bot asked for, run as the bot's owner and only within what both the asking turn's and your credential's scopes cover; its answer is kept (`failed` when it failed or was not covered). `approve_always` also sets the tool to Allow for the bot, `approve_for_subject` allows it on what the call acts on (the older `approve` with `reach` `tool` or `subject` says the same). `deny` runs nothing, and the bot gets a turn that tells it so, with the note, under the same scopes, and carries on. `stop` runs nothing and gives the bot no turn back: the running turn is asked to stop, and the chat keeps a line saying so. Every open chat hears the card closed (`approval_resolved` on the bot's stream).",
  })
  @ApiResponse({ status: 201, type: BotApprovalResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Approval not found', code: 'BOTS_015' })
  @ApiProblemResponse({
    status: 409,
    description: 'The approval was already decided',
    code: 'BOTS_016',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'A decision or reach the card does not offer',
    code: 'BOTS_030',
  })
  @ApiProblemResponse({ status: 409, description: 'Too many standing grants', code: 'BOTS_034' })
  async decide(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('name') name: string | undefined,
    @CurrentScope() credential: ScopeContext | null,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('approvalId', new ParseUUIDPipe()) approvalId: string,
    @Body() body: DecideBotApprovalRequest,
  ): Promise<BotApprovalResponseDto> {
    await this.commandBus.execute<DecideBotApprovalCommand, string>(
      new DecideBotApprovalCommand({
        scope,
        botId,
        approvalId,
        decision: namedBotApprovalDecision(body),
        note: body.note ?? null,
        deciderName: name ?? '',
        credentialScopes: credential ? credential.scopes : null,
      }),
    );
    const approval = await this.queryBus.execute<FindBotApprovalQuery, BotApprovalEntity>(
      new FindBotApprovalQuery(scope, botId, approvalId),
    );
    return this.mapper.toResponse(approval);
  }
}
