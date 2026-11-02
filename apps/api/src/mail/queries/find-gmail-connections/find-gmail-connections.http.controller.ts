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
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { GmailConnectionResponseDto } from '../../dtos/gmail-connection.response.dto';
import { GmailConnectionMapper } from '../../gmail-connection.mapper';
import { FindGmailConnectionsQuery } from './find-gmail-connections.query';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class FindGmailConnectionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: GmailConnectionMapper,
  ) {}

  @Get('gmail/connections')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Mail' })
  @RequireScopes('mail:read')
  @ApiOperation({
    summary: 'The caller’s own Gmail accounts',
    description:
      'Every Gmail account the caller connected for their bots, oldest first (five at most): its address, its name, and whether Google still honours it.',
  })
  @ApiResponse({ status: 200, type: [GmailConnectionResponseDto] })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<GmailConnectionResponseDto[]> {
    const connections = await this.queryBus.execute<
      FindGmailConnectionsQuery,
      GmailConnectionEntity[]
    >(new FindGmailConnectionsQuery({ scope }));
    return connections.map((connection) => this.mapper.toResponse(connection));
  }
}
