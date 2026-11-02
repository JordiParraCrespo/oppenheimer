/// <reference types="multer" />

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { VOICE_AUDIO_MAX_BYTES, type VoiceTranscriptionDto } from '@oppenheimer/shared';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { VoiceTranscriptionResponseDto } from '../../dtos/voice-transcription.response.dto';
import { VoiceAudioInterceptor } from '../../interceptors/voice-audio.interceptor';
import { TranscribeVoiceCommand } from './transcribe-voice.command';
import { TranscribeVoiceRequest } from './transcribe-voice.request.dto';

@ApiTags('Voice')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('voice')
export class TranscribeVoiceHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('transcriptions')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  // Dictation writes a session's first task, so it asks what the create does.
  @CheckPolicies({ action: 'create', subject: 'Session' })
  @RequireScopes('sessions:write')
  @RequireFlag('voice_dictation')
  // A person dictates a few times a minute; this is generous and still bounds what a script can spend.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(VoiceAudioInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: { type: 'string', format: 'binary' },
        vocabulary: { type: 'string', description: 'Names to spell as written, one per line.' },
        language: { type: 'string', description: 'ISO 639-1, when known.' },
      },
      required: ['audio'],
    },
  })
  @ApiOperation({
    summary: 'Transcribe a dictation',
    description: `A recording (16-bit PCM WAV, at most ${VOICE_AUDIO_MAX_BYTES} bytes) in, the text it says out, tidied into writing. Heard by the workspace's ChatGPT sign-in when it has one, otherwise by the deployment's own speech-to-text server. Nothing is kept.`,
  })
  @ApiResponse({ status: 200, type: VoiceTranscriptionResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 400, description: 'No audio attached', code: 'VOICE_002' })
  @ApiProblemResponse({ status: 413, description: 'Recording too long', code: 'VOICE_003' })
  @ApiProblemResponse({ status: 415, description: 'Not 16-bit PCM WAV', code: 'VOICE_004' })
  @ApiProblemResponse({ status: 409, description: 'Nobody to transcribe', code: 'VOICE_005' })
  @ApiProblemResponse({ status: 502, description: 'Provider failed', code: 'VOICE_006' })
  @ApiProblemResponse({ status: 429, description: 'Provider rate limit', code: 'VOICE_007' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async transcribe(
    @Req() request: ScopedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: TranscribeVoiceRequest,
  ): Promise<VoiceTranscriptionResponseDto> {
    return this.commandBus.execute<TranscribeVoiceCommand, VoiceTranscriptionDto>(
      new TranscribeVoiceCommand({
        organizationId: tenantOrganizationIdOf(request),
        audio: file?.buffer,
        vocabulary: body.vocabulary,
        language: body.language,
      }),
    );
  }
}
