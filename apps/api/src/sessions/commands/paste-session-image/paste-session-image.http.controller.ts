// `Express.Multer.File` is a global augmentation from `@types/multer`; see the
// avatar upload for why the reference is needed.
/// <reference types="multer" />

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionDispatchOutcome } from '../../application/session-dispatch.port';
import { SessionImageResponseDto } from '../../dtos/session.response.dto';
import { SessionImageFileInterceptor } from '../../interceptors/session-image-file.interceptor';
import { PasteSessionImageCommand } from './paste-session-image.command';
import { PasteSessionImageRequest } from './paste-session-image.request.dto';

/** The agent's window: the one a session has until somebody opens a tab. */
const AGENT_WINDOW = 0;

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class PasteSessionImageHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/images')
  // 202: the image is on its way to the host, and whether it reached the
  // prompt is the runner's to show — in the prompt, or in the log.
  @HttpCode(HttpStatus.ACCEPTED)
  @Version('1')
  // The same policy and scope as opening a terminal: this is input to one.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  // A paste is a person's action, not a stream; this is well above what a
  // hand does and well below what a loop of 5 MB bodies would cost.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(SessionImageFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        window: { type: 'integer', minimum: 0, description: 'The tmux window; 0 when absent.' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    operationId: 'pasteSessionImage',
    summary: 'Paste an image into a session’s prompt',
    description:
      'The agent reads its host’s clipboard, never the browser’s, so a pasted or dropped screenshot is uploaded here instead. The runner saves it on the host and pastes its path into the window as a bracketed paste. PNG, JPEG, GIF or WebP, 5 MB at most, judged by the bytes.',
  })
  @ApiResponse({ status: 202, type: SessionImageResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 409, description: 'That session is stopped', code: 'SESSIONS_013' })
  @ApiProblemResponse({ status: 413, description: 'Image too large', code: 'SESSIONS_011' })
  @ApiProblemResponse({ status: 415, description: 'Not an image', code: 'SESSIONS_012' })
  async paste(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: PasteSessionImageRequest,
  ): Promise<SessionImageResponseDto> {
    const { delivered, hints } = await this.commandBus.execute<
      PasteSessionImageCommand,
      SessionDispatchOutcome
    >(
      new PasteSessionImageCommand({
        scope,
        sessionId: id,
        window: body.window ?? AGENT_WINDOW,
        data: file.buffer,
      }),
    );
    return { delivered, hints };
  }
}
