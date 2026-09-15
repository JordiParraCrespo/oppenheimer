import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { UserSettingsResponseDto } from '../../dtos/user-settings.response.dto';
import { ProfileMapper } from '../../profile.mapper';
import { GetUserSettingsQuery } from './get-user-settings.query';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class GetUserSettingsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
  ) {}

  @Get('settings')
  @NoPolicy('reads the caller’s own preferences')
  @Version('1')
  @RequireScopes('profile:read')
  @ApiOperation({
    summary: 'Get the current user’s preferences',
    description: 'Answers with the defaults when the user has never saved any.',
  })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  async getSettings(@CurrentUser('id') userId: string): Promise<UserSettingsResponseDto> {
    const settings = await this.queryBus.execute(new GetUserSettingsQuery(userId));
    return this.mapper.toResponse(settings);
  }
}
