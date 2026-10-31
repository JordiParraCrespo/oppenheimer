import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import type { BotDocumentRevision } from '../../domain/bot.types';
import { BotDocumentRevisionResponseDto } from '../../dtos/bot-document-revision.response.dto';
import { FindBotDocumentRevisionsQuery } from './find-bot-document-revisions.query';
import { FindBotDocumentRevisionsRequest } from './find-bot-document-revisions.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotDocumentRevisionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotDocumentMapper,
  ) {}

  @Get(':id/documents/:name/revisions')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'Read a bot document’s revisions',
    description: 'Newest first, at most `limit` (50 unless asked, 100 at most).',
  })
  @ApiParam({ name: 'name', enum: BOT_DOCUMENT_NAMES })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'At most 100; 50 unless asked.',
  })
  @ApiResponse({ status: 200, type: [BotDocumentRevisionResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Bot document not found', code: 'BOTS_005' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('name') name: string,
    @Query() query: FindBotDocumentRevisionsRequest,
  ): Promise<BotDocumentRevisionResponseDto[]> {
    const revisions = await this.queryBus.execute<
      FindBotDocumentRevisionsQuery,
      BotDocumentRevision[]
    >(new FindBotDocumentRevisionsQuery({ scope, botId, name, limit: query.limit }));
    return revisions.map((revision) => this.mapper.revisionToResponse(revision));
  }
}
