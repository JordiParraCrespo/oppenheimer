import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CancelScheduledMailCommand } from './cancel-scheduled-mail.command';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class CancelScheduledMailHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('scheduled/:id/cancel')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Mail' })
  @RequireScopes('mail:write')
  @ApiOperation({
    summary: 'Cancel a scheduled mail',
    description:
      'Stops one of the caller’s scheduled sends while it still waits; it is never sent. One already sent or cancelled is refused.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The scheduled send.' })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Not waiting any more', code: 'MAIL_017' })
  async cancel(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new CancelScheduledMailCommand({ scope, sendId: id }));
  }
}
