import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { VoiceLiveSessionDto } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { VoiceLiveSessionResponseDto } from '../../dtos/voice-live-session.response.dto';
import { StartVoiceLiveCommand } from './start-voice-live.command';
import { StartVoiceLiveRequest } from './start-voice-live.request.dto';

@ApiTags('Voice')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('voice')
export class StartVoiceLiveHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('live')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  // The same ask as a transcription: a live dictation is one, heard as it is said.
  @CheckPolicies({ action: 'create', subject: 'Session' })
  @RequireScopes('sessions:write')
  @RequireFlag('voice_dictation')
  // One per recording, like a transcription.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start a live dictation',
    description:
      "A realtime transcription session for one recording: the WebSocket to stream it to (24 kHz mono 16-bit PCM) and a secret that opens that session for about a minute, so the words can show while they are said. Opened on the deployment's OpenAI key, which never leaves the API. The text to keep is still the recording's transcription when it stops (`POST /voice/transcriptions`).",
  })
  @ApiResponse({ status: 200, type: VoiceLiveSessionResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 409, description: 'Nobody to transcribe', code: 'VOICE_005' })
  @ApiProblemResponse({ status: 409, description: 'No live dictation', code: 'VOICE_008' })
  @ApiProblemResponse({ status: 502, description: 'Provider failed', code: 'VOICE_006' })
  @ApiProblemResponse({ status: 429, description: 'Provider rate limit', code: 'VOICE_007' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async start(
    @Req() request: ScopedRequest,
    @Body() body: StartVoiceLiveRequest,
  ): Promise<VoiceLiveSessionResponseDto> {
    return this.commandBus.execute<StartVoiceLiveCommand, VoiceLiveSessionDto>(
      new StartVoiceLiveCommand({
        organizationId: tenantOrganizationIdOf(request),
        vocabulary: body.vocabulary,
        language: body.language,
      }),
    );
  }
}
