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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { TerminalTicketResponseDto } from '../../dtos/terminal-ticket.response.dto';
import { HostMapper } from '../../host.mapper';
import { IssueTerminalTicketCommand } from './issue-terminal-ticket.command';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class IssueTerminalTicketHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: HostMapper,
  ) {}

  @Post(':id/terminal-tickets')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Host' })
  @RequireScopes('hosts:write')
  @ApiOperation({
    summary: 'Open a shell on a host',
    description:
      'A one-use ticket the runner accepts for a login shell on the host, as the user the runner runs as.',
  })
  @ApiResponse({ status: 201, type: TerminalTicketResponseDto })
  async issue(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TerminalTicketResponseDto> {
    const ticket = await this.commandBus.execute(new IssueTerminalTicketCommand(scope, id));
    return this.mapper.toTerminalTicketResponse(ticket);
  }
}
