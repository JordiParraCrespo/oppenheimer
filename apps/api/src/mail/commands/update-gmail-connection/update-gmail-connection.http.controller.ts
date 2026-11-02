import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { GmailConnectionResponseDto } from '../../dtos/gmail-connection.response.dto';
import { GmailConnectionMapper } from '../../gmail-connection.mapper';
import { FindGmailConnectionQuery } from '../../queries/find-gmail-connection/find-gmail-connection.query';
import { UpdateGmailConnectionCommand } from './update-gmail-connection.command';
import { UpdateGmailConnectionRequest } from './update-gmail-connection.request.dto';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class UpdateGmailConnectionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: GmailConnectionMapper,
  ) {}

  @Patch('gmail/connections/:id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Mail' })
  @RequireScopes('mail:write')
  @ApiOperation({
    summary: 'Rename a Gmail account',
    description:
      'What the caller and their bots call the account ("Personal", "Work"). A blank name falls back to its address.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connection.' })
  @ApiResponse({ status: 200, type: GmailConnectionResponseDto })
  @ApiProblemResponse({
    status: 409,
    description: 'No such connection of the caller’s',
    code: 'MAIL_001',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGmailConnectionRequest,
  ): Promise<GmailConnectionResponseDto> {
    const connectionId = await this.commandBus.execute<UpdateGmailConnectionCommand, AggregateID>(
      new UpdateGmailConnectionCommand({ scope, connectionId: id, input: body }),
    );
    const connection = await this.queryBus.execute<FindGmailConnectionQuery, GmailConnectionEntity>(
      new FindGmailConnectionQuery({ scope, id: connectionId }),
    );
    return this.mapper.toResponse(connection);
  }
}
