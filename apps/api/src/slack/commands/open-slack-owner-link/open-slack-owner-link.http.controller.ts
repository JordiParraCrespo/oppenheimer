import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SlackOwnerLinkResponseDto } from '../../dtos/slack-owner-link.response.dto';
import { SlackAccountMapper } from '../../slack-account.mapper';
import {
  type OpenedSlackOwnerLink,
  OpenSlackOwnerLinkCommand,
} from './open-slack-owner-link.command';

@ApiTags('Slack')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('slack')
export class OpenSlackOwnerLinkHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: SlackAccountMapper,
  ) {}

  @Post('accounts/:id/owner-link')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Slack' })
  // Session-only: the owner's Slack user starts turns with the bot's full
  // tools and memory, so no API token or OAuth grant may name it.
  @ApiOperation({
    summary: 'Make a one-time code that records the owner',
    description:
      'Answers the message to send the bot’s Slack app in its DM, with a one-time code, and a link that opens that DM. Whoever sends it within ten minutes is recorded as the owner: the only Slack user the bot answers. A new code replaces an open one; it is stored hashed, so only this answer carries it.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connected Slack app.' })
  @ApiResponse({ status: 201, type: SlackOwnerLinkResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such Slack app', code: 'SLACK_001' })
  async open(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SlackOwnerLinkResponseDto> {
    const link = await this.commandBus.execute<OpenSlackOwnerLinkCommand, OpenedSlackOwnerLink>(
      new OpenSlackOwnerLinkCommand({ scope, accountId: id }),
    );
    return this.mapper.toOwnerLinkResponse(link);
  }
}
