import {
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { BOT_DOCUMENT_NAMES } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotDocumentMapper } from '../../bot-document.mapper';
import type { BotDocumentEntity } from '../../domain/bot-document.entity';
import { BotDocumentResponseDto } from '../../dtos/bot-document.response.dto';
import { FindBotDocumentQuery } from '../../queries/find-bot-document/find-bot-document.query';
import { RevertBotDocumentCommand } from './revert-bot-document.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class RevertBotDocumentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotDocumentMapper,
  ) {}

  @Post(':id/documents/:name/revisions/:revision/revert')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Revert a bot document to a revision',
    description:
      'Writes that revision’s content as the next revision, so nothing in the history is lost.',
  })
  @ApiParam({ name: 'name', enum: BOT_DOCUMENT_NAMES })
  @ApiResponse({ status: 200, type: BotDocumentResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Bot document not found', code: 'BOTS_005' })
  @ApiProblemResponse({ status: 404, description: 'Revision not found', code: 'BOTS_007' })
  @ApiProblemResponse({
    status: 409,
    description: 'The document was changed since it was loaded',
    code: 'BOTS_006',
  })
  async revert(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('name') name: string,
    @Param('revision', ParseIntPipe) revision: number,
  ): Promise<BotDocumentResponseDto> {
    await this.commandBus.execute<RevertBotDocumentCommand, string>(
      new RevertBotDocumentCommand({ scope, botId, name, revision }),
    );
    const document = await this.queryBus.execute<FindBotDocumentQuery, BotDocumentEntity>(
      new FindBotDocumentQuery({ scope, botId, name }),
    );
    return this.mapper.toResponse(document);
  }
}
