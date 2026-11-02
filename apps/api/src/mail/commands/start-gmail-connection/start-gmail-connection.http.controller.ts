import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GmailConnectStartResponseDto } from '../../dtos/gmail-connection.response.dto';
import { StartGmailConnectionCommand } from './start-gmail-connection.command';
import type { StartedGmailConnection } from './start-gmail-connection.command-handler';
import { StartGmailConnectionRequest } from './start-gmail-connection.request.dto';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class StartGmailConnectionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('gmail/connections')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'create', subject: 'Mail' })
  @RequireScopes('mail:write')
  @ApiOperation({
    summary: 'Start connecting a Gmail account',
    description:
      'Google’s consent page for Gmail, with its account chooser, carrying a single-use state for this caller in this workspace. With `connectionId`, a reconnect of that account: the chooser opens on its address. Google redirects to the console’s `/settings/mail/google`, which posts the code back.',
  })
  @ApiResponse({ status: 200, type: GmailConnectStartResponseDto })
  @ApiProblemResponse({
    status: 409,
    description:
      'Five accounts already connected, or no such connection of the caller’s to reconnect',
    code: ['MAIL_003', 'MAIL_001'],
  })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'MAIL_004' })
  async start(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: StartGmailConnectionRequest,
  ): Promise<GmailConnectStartResponseDto> {
    const started = await this.commandBus.execute<
      StartGmailConnectionCommand,
      StartedGmailConnection
    >(new StartGmailConnectionCommand({ scope, input: body ?? {} }));
    return { url: started.url, expiresAt: started.expiresAt.toISOString() };
  }
}
