import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AccessScope, requireTenant } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { VoiceSettingsDto } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { VoiceSettingsResponseDto } from '../../dtos/voice-settings.response.dto';
import { FindVoiceSettingsQuery } from './find-voice-settings.query';

@ApiTags('Voice')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('voice')
export class FindVoiceSettingsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('settings')
  @Version('1')
  // Beside the model providers in Settings, and guarded like them.
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'How the workspace hears and speaks',
    description:
      'The provider and model that transcribe dictation and voice notes, the provider, model and voice bots speak voice notes in, and the model that tidies a transcript; null is automatic. `available` lists what the workspace can use now, in the order each is tried.',
  })
  @ApiResponse({ status: 200, type: VoiceSettingsResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<VoiceSettingsResponseDto> {
    requireTenant(scope);
    return this.queryBus.execute<FindVoiceSettingsQuery, VoiceSettingsDto>(
      new FindVoiceSettingsQuery(scope.organizationId),
    );
  }
}
