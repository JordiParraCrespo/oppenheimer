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
import { SlackAccountResponseDto } from '../../dtos/slack-account.response.dto';
import { FindSlackAccountsQuery } from './find-slack-accounts.query';

@ApiTags('Slack')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('slack')
export class FindSlackAccountsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('accounts')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Slack' })
  @RequireScopes('slack:read')
  @ApiOperation({
    summary: 'List your bots’ Slack apps',
    description:
      'Each connected app, the bot it is and the Slack workspace it is in. Never a token.',
  })
  @ApiResponse({ status: 200, type: [SlackAccountResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<SlackAccountResponseDto[]> {
    return this.queryBus.execute(new FindSlackAccountsQuery({ scope }));
  }
}
