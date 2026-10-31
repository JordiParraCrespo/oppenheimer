import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ReportCloudStatusResponse } from '../../dtos/report-cloud-status.response.dto';
import { RecordCloudStatusCommand } from './record-cloud-status.command';
import type { RecordCloudStatusResult } from './record-cloud-status.command-handler';
import { ReportCloudStatusRequest } from './record-cloud-status.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class RecordCloudStatusHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-status')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  // The extension reports once a minute; a few more for a person pressing refresh.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Report what Claude Code cloud sessions are doing',
    description:
      "The browser extension's view of the person's Claude Code cloud sessions on claude.ai. The ones this workspace launched (`place: cloud`) record it as the agent's observed state, which draws their dot; the rest are ignored.",
  })
  @ApiOkResponse({ type: ReportCloudStatusResponse })
  async report(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: ReportCloudStatusRequest,
  ): Promise<ReportCloudStatusResponse> {
    return this.commandBus.execute<RecordCloudStatusCommand, RecordCloudStatusResult>(
      new RecordCloudStatusCommand({ scope, report: body }),
    );
  }
}
