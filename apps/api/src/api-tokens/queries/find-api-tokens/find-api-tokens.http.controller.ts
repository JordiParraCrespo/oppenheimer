import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { ApiTokenMapper } from '../../api-tokens.mapper';
import type { ApiTokenEntity } from '../../domain/api-token.entity';
import { ApiTokenResponseDto } from '../../dtos/api-token.response.dto';
import { FindApiTokensQuery } from './find-api-tokens.query';

@ApiTags('API tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('tokens')
export class FindApiTokensHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ApiTokenMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'ApiToken' })
  @RequireScopes('tokens:read')
  @ApiOperation({
    summary: 'List the caller’s API tokens',
    description: 'Secrets are never returned — only the display prefix and metadata.',
  })
  @ApiResponse({ status: 200, type: [ApiTokenResponseDto] })
  async findAll(@CurrentUser('id') userId: string): Promise<ApiTokenResponseDto[]> {
    const tokens = await this.queryBus.execute<FindApiTokensQuery, ApiTokenEntity[]>(
      new FindApiTokensQuery({ userId }),
    );
    return tokens.map((token) => this.mapper.toResponse(token));
  }
}
