import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotDocumentMapper } from '../../bot-document.mapper';
import type { BotDocumentEntity } from '../../domain/bot-document.entity';
import { BotDocumentResponseDto } from '../../dtos/bot-document.response.dto';
import { FindBotDocumentsQuery } from './find-bot-documents.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotDocumentsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotDocumentMapper,
  ) {}

  @Get(':id/documents')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'Read a bot’s soul and instructions',
    description: 'Both documents, soul first, each with the revision a save sends back.',
  })
  @ApiResponse({ status: 200, type: [BotDocumentResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotDocumentResponseDto[]> {
    const documents = await this.queryBus.execute<FindBotDocumentsQuery, BotDocumentEntity[]>(
      new FindBotDocumentsQuery({ scope, botId }),
    );
    return documents.map((document) => this.mapper.toResponse(document));
  }
}
