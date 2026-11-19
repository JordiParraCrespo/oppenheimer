import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RevokeWhatsappChatCommand } from './revoke-whatsapp-chat.command';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class RevokeWhatsappChatHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('accounts/:id/grants/:grantId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:write')
  @ApiOperation({
    summary: 'Stop allowing a WhatsApp chat',
    description:
      'The group or person no longer talks to the number’s bots. What was said there stays kept for the owner’s bots to read.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiParam({ name: 'grantId', format: 'uuid', description: 'The allowed chat.' })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({ status: 404, description: 'No such allowed chat', code: 'WHATSAPP_016' })
  async revoke(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('grantId', ParseUUIDPipe) grantId: string,
  ): Promise<void> {
    await this.commandBus.execute(new RevokeWhatsappChatCommand({ scope, accountId: id, grantId }));
  }
}
