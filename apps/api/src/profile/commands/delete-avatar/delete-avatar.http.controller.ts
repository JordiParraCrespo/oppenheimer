import { Controller, Delete, Inject, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import { GetProfileQuery } from '../../queries/get-profile/get-profile.query';
import { DeleteAvatarCommand } from './delete-avatar.command';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class DeleteAvatarHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
    @Inject(AVATAR_STORAGE)
    private readonly avatars: AvatarStoragePort,
  ) {}

  @Delete('avatar')
  @NoPolicy('clears the caller’s own avatar')
  @Version('1')
  @RequireScopes('profile:write')
  @ApiOperation({ summary: 'Remove the current user’s avatar' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Profile not found',
    code: 'PROFILE_001',
  })
  async deleteAvatar(@CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    await this.commandBus.execute(new DeleteAvatarCommand({ userId }));
    const user = await this.queryBus.execute(new GetProfileQuery(userId));
    return this.mapper.toProfileResponse(user, await this.avatars.resolveUrl(user.avatarUrl));
  }
}
