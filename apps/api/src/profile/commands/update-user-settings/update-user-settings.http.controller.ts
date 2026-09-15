import { Body, Controller, Put, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { UserSettingsResponseDto } from '../../dtos/user-settings.response.dto';
import { ProfileMapper } from '../../profile.mapper';
import { GetUserSettingsQuery } from '../../queries/get-user-settings/get-user-settings.query';
import { UpdateUserSettingsCommand } from './update-user-settings.command';
import { UpdateUserSettingsRequest } from './update-user-settings.request.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class UpdateUserSettingsHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
  ) {}

  @Put('settings')
  @NoPolicy('updates the caller’s own preferences')
  @Version('1')
  @RequireScopes('profile:write')
  @ApiOperation({
    summary: 'Replace the current user’s preferences',
    description: 'Every preference is required — this is a replace, not a patch.',
  })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body() body: UpdateUserSettingsRequest,
  ): Promise<UserSettingsResponseDto> {
    await this.commandBus.execute(new UpdateUserSettingsCommand({ userId, ...body }));
    const settings = await this.queryBus.execute(new GetUserSettingsQuery(userId));
    return this.mapper.toResponse(settings);
  }
}
