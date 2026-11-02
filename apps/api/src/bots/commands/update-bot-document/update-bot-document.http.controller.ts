import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { BOT_DOCUMENT_NAMES } from '@oppenheimer/shared';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotDocumentMapper } from '../../bot-document.mapper';
import type { BotDocumentEntity } from '../../domain/bot-document.entity';
import { BotDocumentResponseDto } from '../../dtos/bot-document.response.dto';
import { FindBotDocumentQuery } from '../../queries/find-bot-document/find-bot-document.query';
import { UpdateBotDocumentCommand } from './update-bot-document.command';
import { UpdateBotDocumentRequest } from './update-bot-document.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class UpdateBotDocumentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotDocumentMapper,
  ) {}

  @Put(':id/documents/:name')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Save a bot’s soul or instructions',
    description:
      'Saved over `baseRevision`, the revision the editor loaded, as the next revision. Saving the stored content makes no revision.',
  })
  @ApiParam({ name: 'name', enum: BOT_DOCUMENT_NAMES })
  @ApiResponse({ status: 200, type: BotDocumentResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Bot document not found', code: 'BOTS_005' })
  @ApiProblemResponse({
    status: 409,
    description: 'The document was changed since it was loaded',
    code: 'BOTS_006',
  })
  async save(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('name') name: string,
    @Body() body: UpdateBotDocumentRequest,
  ): Promise<BotDocumentResponseDto> {
    await this.commandBus.execute<UpdateBotDocumentCommand, string>(
      new UpdateBotDocumentCommand({ scope, botId, name, input: body }),
    );
    const document = await this.queryBus.execute<FindBotDocumentQuery, BotDocumentEntity>(
      new FindBotDocumentQuery({ scope, botId, name }),
    );
    return this.mapper.toResponse(document);
  }
}
