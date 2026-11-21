import {
  Body,
  Controller,
  HttpCode,
  Put,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AccessScope, requireTenant } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { UpdateVoiceSettingsCommand } from './update-voice-settings.command';
import { UpdateVoiceSettingsRequest } from './update-voice-settings.request.dto';

@ApiTags('Voice')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('voice')
export class UpdateVoiceSettingsHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('settings')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Choose how the workspace hears and speaks',
    description:
      'Replaces the voice choices whole. A model or voice is one its provider lists (ElevenLabs takes any voice id); null is automatic, or the provider’s default.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: UpdateVoiceSettingsRequest,
  ): Promise<void> {
    requireTenant(scope);
    await this.commandBus.execute<UpdateVoiceSettingsCommand, void>(
      new UpdateVoiceSettingsCommand({ organizationId: scope.organizationId, settings: body }),
    );
  }
}
