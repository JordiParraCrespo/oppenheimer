import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import {
  activeOrganizationIdOf,
  type ScopedRequest,
} from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { MyPermissionsResponseDto } from '../../dtos/my-permissions.response.dto';
import { GetMyPermissionsQuery } from './get-my-permissions.query';

@ApiTags('Users')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('users')
export class GetMyPermissionsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('me/permissions')
  @NoPolicy('returns the caller’s own effective permissions')
  @Version('1')
  @RequireScopes('profile:read')
  @ApiOperation({
    summary: 'Get the current user’s effective permissions',
    description:
      'The union of every role assigned to the caller, as CASL rules. Drives which routes the web app shows in its sidebar.',
  })
  @ApiResponse({ status: 200, type: MyPermissionsResponseDto })
  async permissions(
    @Req() request: ScopedRequest,
    @CurrentUser() user: { id: string; role?: string },
  ): Promise<MyPermissionsResponseDto> {
    const permissions = await this.queryBus.execute<GetMyPermissionsQuery, PermissionDefinition[]>(
      new GetMyPermissionsQuery({
        userId: user.id,
        role: user.role,
        activeOrganizationId: activeOrganizationIdOf(request),
      }),
    );

    return { permissions };
  }
}
