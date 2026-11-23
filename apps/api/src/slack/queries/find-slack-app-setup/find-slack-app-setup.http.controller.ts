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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SlackAppSetupResponseDto } from '../../dtos/slack-app-setup.response.dto';
import { FindSlackAppSetupQuery } from './find-slack-app-setup.query';

@ApiTags('Slack')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('slack')
export class FindSlackAppSetupHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('bots/:botId/app')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Slack' })
  @RequireScopes('slack:read')
  @ApiOperation({
    summary: 'What creating a bot’s Slack app takes',
    description:
      'The address Slack sends the bot’s events to, its app manifest (the bot’s name, the scopes and events it needs), and the link that opens Slack’s "Create an app" with the manifest filled in.',
  })
  @ApiParam({ name: 'botId', format: 'uuid', description: 'One of the caller’s bots.' })
  @ApiResponse({ status: 200, type: SlackAppSetupResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such bot of yours', code: 'BOTS_001' })
  @ApiProblemResponse({
    status: 503,
    description: 'Slack is not configured on this server',
    code: 'SLACK_003',
  })
  async setup(
    @CurrentAccessScope() scope: AccessScope,
    @Param('botId', ParseUUIDPipe) botId: string,
  ): Promise<SlackAppSetupResponseDto> {
    return this.queryBus.execute(new FindSlackAppSetupQuery({ scope, botId }));
  }
}
