import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { VoiceStatusDto } from '@oppenheimer/shared';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { VoiceStatusResponseDto } from '../../dtos/voice-status.response.dto';
import { FindVoiceStatusQuery } from './find-voice-status.query';

@ApiTags('Voice')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('voice')
export class FindVoiceStatusHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('status')
  @Version('1')
  // The mic sits in the session composer: whoever may read sessions may ask.
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @ApiOperation({
    summary: 'Whether the workspace can dictate',
    description:
      'The speech providers available to the workspace, in the order a dictation tries them. Empty: nobody can hear a recording, and the console shows no mic.',
  })
  @ApiResponse({ status: 200, type: VoiceStatusResponseDto })
  async status(@Req() request: ScopedRequest): Promise<VoiceStatusResponseDto> {
    return this.queryBus.execute<FindVoiceStatusQuery, VoiceStatusDto>(
      new FindVoiceStatusQuery(tenantOrganizationIdOf(request)),
    );
  }
}
