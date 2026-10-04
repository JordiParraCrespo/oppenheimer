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
  // 202: the host has the command and pulls the image itself. A host that
  // cannot take it is an error, never a 202.
  @HttpCode(HttpStatus.ACCEPTED)
  @Version('1')
  // The same policy and scope as opening a terminal: this is input to one.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  // A paste is a person's action: well above a hand, well below a loop.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(SessionImageFileInterceptor)
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
    summary: 'Paste a file into a session’s prompt',
    description:
      'The agent reads its host’s clipboard, not the browser’s, so a pasted screenshot or a dropped file comes here: an image, a PDF, or UTF-8 text, judged by its bytes. The host’s runner pulls it, saves it under a name of its own and pastes its path into the window.',
  })
  @ApiResponse({ status: 202, description: 'The host has been told to pull the file' })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 409, description: 'That session is stopped', code: 'SESSIONS_014' })
  @ApiProblemResponse({ status: 413, description: 'File too large', code: 'SESSIONS_012' })
  @ApiProblemResponse({ status: 415, description: 'Not a file it takes', code: 'SESSIONS_013' })
  @ApiProblemResponse({ status: 400, description: 'No file attached', code: 'SESSIONS_015' })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 409, description: 'Runner cannot take it', code: 'SESSIONS_017' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async paste(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: PasteSessionImageRequest,
  ): Promise<void> {
    await this.commandBus.execute<PasteSessionImageCommand, void>(
      new PasteSessionImageCommand({
        scope,
        sessionId: id,
        window: body.window ?? AGENT_WINDOW,
        data: file.buffer,
        hint: { mediaType: file.mimetype, fileName: file.originalname },
      }),
    );
  }
}
