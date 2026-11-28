import {
  Body,
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
import { ReleasedCloudReplyResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { ReleaseCloudReplyCommand } from './release-cloud-reply.command';
import { ReleaseCloudReplyRequest } from './release-cloud-reply.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class ReleaseCloudReplyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-replies/:replyId/release')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  // Both: the person's sessions and their cloud chats. `sessions:write` alone
  // (an `opp` or MCP token) never reads or takes the replies they type.
  @RequireScopes('sessions:write', 'cloud-chat:write')
  @ApiOperation({
    summary: 'Hand back a reply claude.ai refused',
    description:
      'What the browser extension says when claude.ai refused a reply it claimed: the reply waits again, for the session’s Stop hook. `released: false` when it was not the caller’s claim to hand back.',
  })
  @ApiOkResponse({ type: ReleasedCloudReplyResponseDto })
  async release(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('replyId', ParseUUIDPipe) replyId: string,
    @Body() body: ReleaseCloudReplyRequest,
  ): Promise<ReleasedCloudReplyResponseDto> {
    const released = await this.commandBus.execute<ReleaseCloudReplyCommand, boolean>(
      new ReleaseCloudReplyCommand({ scope, userId, replyId, reason: body.reason }),
    );
    return { released };
  }
}
