import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SlackAccountResponseDto } from '../../dtos/slack-account.response.dto';
import { FindSlackAccountQuery } from '../../queries/find-slack-account/find-slack-account.query';
import { ConnectSlackCommand } from './connect-slack.command';
import { ConnectSlackRequest } from './connect-slack.request.dto';

@ApiTags('Slack')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('slack')
export class ConnectSlackHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('accounts')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Slack' })
  @RequireScopes('slack:write')
  @ApiOperation({
    summary: 'Connect a bot’s own Slack app',
    description:
      'Slack is asked whose the bot token is first; a token it refuses is not stored. The token and the signing secret are sealed, replace the bot’s earlier ones, and are never returned. The app answers only its owner, once they send it the code of `POST /slack/accounts/{id}/owner-link`.',
  })
  @ApiBody({ type: ConnectSlackRequest })
  @ApiResponse({ status: 201, type: SlackAccountResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'SLACK_002' })
  @ApiProblemResponse({ status: 404, description: 'No such bot of yours', code: 'BOTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'That Slack app already answers as another bot',
    code: 'SLACK_005',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'Slack refused the bot token',
    code: 'SLACK_004',
  })
  @ApiProblemResponse({
    status: 429,
    description: "Slack's rate limit was reached; try again after Retry-After",
    code: 'SLACK_007',
  })
  @ApiProblemResponse({ status: 502, description: 'Slack did not answer', code: 'SLACK_006' })
  @ApiProblemResponse({
    status: 503,
    description: 'Slack is not configured on this server',
    code: 'SLACK_003',
  })
  async connect(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: ConnectSlackRequest,
  ): Promise<SlackAccountResponseDto> {
    const id = await this.commandBus.execute<ConnectSlackCommand, AggregateID>(
      new ConnectSlackCommand({ scope, ...body }),
    );
    return this.queryBus.execute(new FindSlackAccountQuery({ scope, accountId: id }));
  }
}
