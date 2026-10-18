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
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
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
      "`approve` names the card's `callDigest` and queues exactly that call, run as the bot's owner and only within what both the asking turn's and your credential's scopes cover; its answer is kept (`failed` when it failed or was not covered). `deny` runs nothing. Either way the bot gets a turn that tells it what was decided, with the note, under the same scopes, and it reports back in the chat. A card past its `expiresAt` cannot be decided: it expires.",
  })
  @ApiResponse({ status: 201, type: BotApprovalResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Approval not found', code: 'BOTS_015' })
  @ApiProblemResponse({
    status: 409,
    description: 'Already decided, or a yes for another call',
    code: ['BOTS_016', 'BOTS_024'],
  })
  @ApiProblemResponse({ status: 410, description: 'The approval expired', code: 'BOTS_023' })
  @ApiProblemResponse({
    status: 403,
    description: 'Your roles or credential do not permit this, or what the call does',
    code: ['AUTH_002', 'TOKEN_004', 'TOKEN_005', 'TOKEN_006', 'TOKEN_007', 'BOTS_025'],
  })
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
        decision: body.decision,
        note: body.note ?? null,
        deciderName: name ?? '',
        credentialScopes: credential ? credential.scopes : null,
        callDigest: body.callDigest ?? null,
      }),
    );
    const approval = await this.queryBus.execute<FindBotApprovalQuery, BotApprovalEntity>(
      new FindBotApprovalQuery(scope, botId, approvalId),
    );
    return this.mapper.toResponse(approval);
  }
}
