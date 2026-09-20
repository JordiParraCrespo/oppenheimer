import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AllowAnyScope } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopeContext, ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CurrentCredentialResponseDto } from '../../dtos/current-credential.response.dto';
import { FindCurrentCredentialQuery } from './find-current-credential.query';
import type { CurrentCredentialScopes } from './find-current-credential.query-handler';

@ApiTags('API tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('me')
export class FindCurrentCredentialHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('credential')
  @NoPolicy('describes only the calling credential itself')
  @Version('1')
  // Every credential may ask what it is; that is the point of this route, and
  // requiring a scope for it would make a token unable to discover its own.
  @AllowAnyScope()
  @ApiOperation({
    summary: 'Describe the calling credential and its effective permissions',
    description:
      'Returns the credential kind, its granted scopes and what those scopes actually amount to once the owner’s roles are applied. The MCP server filters its tool list by `effectiveScopes`.',
  })
  @ApiResponse({ status: 200, type: CurrentCredentialResponseDto })
  async current(
    @Req() request: ScopedRequest,
    @CurrentUser() user: { id: string; email: string; role?: string },
    @CurrentScope() scope: ScopeContext | null,
  ): Promise<CurrentCredentialResponseDto> {
    const session = request.session as {
      activeOrganizationId?: string | null;
    } | null;

    // This route describes a *person's* credential. A host's assertion is a
    // credential with no person behind it and never reaches here — `ApiAuthGuard`
    // refuses it before the handler runs — so narrowing it away keeps the
    // mapping below total without inventing a kind the response can return.
    const credential = scope?.kind === 'host' ? null : scope;

    const { grantedScopes, effectiveScopes } = await this.queryBus.execute<
      FindCurrentCredentialQuery,
      CurrentCredentialScopes
    >(
      new FindCurrentCredentialQuery({
        userId: user.id,
        role: user.role,
        activeOrganizationId: session?.activeOrganizationId ?? null,
        grantedScopes: credential?.scopes ?? null,
      }),
    );

    return {
      kind: credential?.kind ?? 'session',
      userId: user.id,
      email: user.email,
      grantedScopes,
      effectiveScopes,
      organizationIds: credential?.resourceScope.organizationIds ?? null,
      expiresAt: credential?.expiresAt ?? null,
    };
  }
}
