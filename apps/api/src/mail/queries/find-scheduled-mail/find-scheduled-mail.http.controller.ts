import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { MailSendEntity } from '../../domain/mail-send.entity';
import { ScheduledMailResponseDto } from '../../dtos/scheduled-mail.response.dto';
import { MailSendMapper } from '../../mail-send.mapper';
import { FindScheduledMailQuery } from './find-scheduled-mail.query';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class FindScheduledMailHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: MailSendMapper,
  ) {}

  @Get('scheduled')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Mail' })
  @RequireScopes('mail:read')
  @ApiOperation({
    summary: 'The caller’s scheduled mail',
    description:
      'Messages the caller’s bots will send from their Gmail at a time, still waiting, soonest first: from which account, to whom, the subject and when.',
  })
  @ApiResponse({ status: 200, type: [ScheduledMailResponseDto] })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<ScheduledMailResponseDto[]> {
    const sends = await this.queryBus.execute<FindScheduledMailQuery, MailSendEntity[]>(
      new FindScheduledMailQuery({ scope }),
    );
    return sends.map((send) => this.mapper.toScheduledResponse(send));
  }
}
