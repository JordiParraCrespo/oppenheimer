import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ConfirmedCloudReplyResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { ConfirmCloudReplyCommand } from './confirm-cloud-reply.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class ConfirmCloudReplyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-replies/:replyId/delivered')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  // Both: the person's sessions and their cloud chats. `sessions:write` alone
  // (an `opp` or MCP token) never reads or takes the replies they type.
  @RequireScopes('sessions:write', 'cloud-chat:write')
  @ApiOperation({
    summary: 'Say claude.ai took a reply you claimed',
    description:
      'What the browser extension says once claude.ai took a reply it claimed and posted: the claim stops lapsing, so the session’s Stop hook or a host never delivers it again. `delivered: false` when it was not the caller’s claim, or it lapsed and another way took it.',
  })
  @ApiOkResponse({ type: ConfirmedCloudReplyResponseDto })
  async confirm(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('replyId', ParseUUIDPipe) replyId: string,
  ): Promise<ConfirmedCloudReplyResponseDto> {
    const delivered = await this.commandBus.execute<ConfirmCloudReplyCommand, boolean>(
      new ConfirmCloudReplyCommand({ scope, userId, replyId }),
    );
    return { delivered };
  }
}
