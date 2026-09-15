import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import type { ScopedRequest } from '../../../auth/scope-context';
import { AuthzCatalogResponseDto } from '../../dtos/authz-catalog.response.dto';
import { FindAuthzCatalogQuery } from './find-catalog.query';

@ApiTags('Authorization')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('authz')
export class FindAuthzCatalogHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('catalog')
  @Version('1')
  @NoPolicy('describes what the caller may grant, derived from their own ability')
  @RequireScopes('roles:read')
  @ApiOperation({
    summary: 'List every declared resource and what the caller may grant',
    description:
      'Drives the role builder. Resources are contributed by the modules that own them, so a new module appears here without editing a central catalog.',
  })
  @ApiResponse({ status: 200, type: AuthzCatalogResponseDto })
  async catalog(
    @Req() request: ScopedRequest,
    @CurrentUser() user: { id: string; role?: string },
  ): Promise<AuthzCatalogResponseDto> {
    const session = request.session as {
      activeOrganizationId?: string | null;
    } | null;

    return this.queryBus.execute<FindAuthzCatalogQuery, AuthzCatalogResponseDto>(
      new FindAuthzCatalogQuery({
        userId: user.id,
        role: user.role,
        activeOrganizationId: session?.activeOrganizationId ?? null,
      }),
    );
  }
}
