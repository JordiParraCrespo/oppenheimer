import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { RevokeShareLinkCommand } from './revoke-share-link.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class RevokeShareLinkHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id/share-links/:linkId')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    summary: 'Revoke a share link',
    description:
      'Nothing opens through it again. A terminal already open through it closes within a minute.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Share link not found', code: 'SESSIONS_021' })
  async revoke(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<void> {
    await this.commandBus.execute(new RevokeShareLinkCommand({ scope, sessionId: id, linkId }));
  }
}
