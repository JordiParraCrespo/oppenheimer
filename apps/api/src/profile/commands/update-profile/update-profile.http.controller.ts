import { Body, Controller, Patch, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { ProfileResponseDto } from '../../dtos/profile.response.dto';
import { ProfileMapper } from '../../profile.mapper';
import { GetProfileQuery } from '../../queries/get-profile/get-profile.query';
import { AvatarStorage } from '../../services/avatar.storage';
import { UpdateProfileCommand } from './update-profile.command';
import { UpdateProfileRequest } from './update-profile.request.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class UpdateProfileHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
    private readonly avatars: AvatarStorage,
  ) {}

  @Patch()
  @NoPolicy('updates the caller’s own account')
  @Version('1')
  @RequireScopes('profile:write')
  @ApiOperation({ summary: 'Update the current user’s profile' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Profile not found',
    code: 'PROFILE_001',
  })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() body: UpdateProfileRequest,
  ): Promise<ProfileResponseDto> {
    await this.commandBus.execute(new UpdateProfileCommand({ userId, ...body }));
    const user = await this.queryBus.execute(new GetProfileQuery(userId));
    return this.mapper.toProfileResponse(user, await this.avatars.resolveUrl(user.avatarUrl));
  }
}
