import { Controller, Get, Inject, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { ProfileResponseDto } from '../../dtos/profile.response.dto';
import type { AvatarStoragePort } from '../../infrastructure/avatar-storage.port';
import { AVATAR_STORAGE } from '../../profile.di-tokens';
import { ProfileMapper } from '../../profile.mapper';
import { GetProfileQuery } from './get-profile.query';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class GetProfileHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
    @Inject(AVATAR_STORAGE)
    private readonly avatars: AvatarStoragePort,
  ) {}

  @Get()
  @NoPolicy('reads the caller’s own account')
  @Version('1')
  @RequireScopes('profile:read')
  @ApiOperation({ summary: 'Get the current user’s profile' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Profile not found',
    code: 'PROFILE_001',
  })
  async getProfile(@CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    const user = await this.queryBus.execute(new GetProfileQuery(userId));
    return this.mapper.toProfileResponse(user, await this.avatars.resolveUrl(user.avatarUrl));
  }
}
