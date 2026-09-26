import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { ApiTokenMapper } from '../../api-tokens.mapper';
import type { ApiTokenEntity } from '../../domain/api-token.entity';
import { CreatedApiTokenResponseDto } from '../../dtos/api-token.response.dto';
import { FindApiTokenByIdQuery } from '../../queries/find-api-token-by-id/find-api-token-by-id.query';
import { CreateApiTokenCommand } from './create-api-token.command';
import type { CreateApiTokenResult } from './create-api-token.command-handler';
import { CreateApiTokenRequest } from './create-api-token.request.dto';

@ApiTags('API tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('tokens')
export class CreateApiTokenHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: ApiTokenMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'ApiToken' })
  @RequireScopes('tokens:write')
  // The kill switch: off stops new tokens being minted, existing ones keep working.
  @RequireFlag('api_token_creation')
  // Minting credentials is a high-value operation; keep it well below the
  // global rate limit.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Mint an API token',
    description:
      'Creates a scoped API token for the caller. The secret is returned once and cannot be retrieved again. Scopes may not exceed what the caller is themselves permitted to do.',
  })
  @ApiResponse({ status: 201, type: CreatedApiTokenResponseDto })
  @ApiProblemResponse({
    status: 403,
    description:
      'Requested scopes exceed the caller’s own permissions, or the caller is not a member of a requested organization',
    code: ['TOKEN_002', 'TOKEN_008'],
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Active token limit reached',
    code: 'TOKEN_009',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async create(
    @Req() request: ScopedRequest,
    @CurrentUser() user: { id: string; role?: string },
    @Body() body: CreateApiTokenRequest,
  ): Promise<CreatedApiTokenResponseDto> {
    const session = request.session as {
      activeOrganizationId?: string | null;
    } | null;

    const { tokenId, secret } = await this.commandBus.execute<
      CreateApiTokenCommand,
      CreateApiTokenResult
    >(
      new CreateApiTokenCommand({
        actor: {
          id: user.id,
          role: user.role,
          activeOrganizationId: session?.activeOrganizationId ?? null,
        },
        name: body.name,
        scopes: body.scopes,
        organizationIds: body.organizationIds,
        expiresInDays: body.expiresInDays,
        ipAllowlist: body.ipAllowlist,
      }),
    );

    const token = await this.queryBus.execute<FindApiTokenByIdQuery, ApiTokenEntity>(
      new FindApiTokenByIdQuery({ tokenId, userId: user.id }),
    );

    return { ...this.mapper.toResponse(token), token: secret };
  }
}
