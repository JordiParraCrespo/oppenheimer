// `Express.Multer.File` is a global augmentation from `@types/multer`, which
// nothing in this file imports — without this reference the namespace is
// missing and the uploaded-file type does not resolve.
/// <reference types="multer" />

import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse, AppError } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { ProfileErrors } from '../../domain/profile.errors';
import { ProfileResponseDto } from '../../dtos/profile.response.dto';
import { ProfileMapper } from '../../profile.mapper';
import { GetProfileQuery } from '../../queries/get-profile/get-profile.query';
import { AvatarStorage } from '../../services/avatar.storage';
import { AvatarFileInterceptor } from '../../services/avatar-file.interceptor';
import { UploadAvatarCommand } from './upload-avatar.command';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class UploadAvatarHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
    private readonly avatars: AvatarStorage,
  ) {}

  @Post('avatar')
  @NoPolicy('replaces the caller’s own avatar')
  @Version('1')
  @RequireScopes('profile:write')
  // Memory storage: an avatar is capped at a couple of megabytes and goes
  // straight to the storage back-end, so writing it to a temp file first would
  // only add a path to clean up. The interceptor carries multer's size limit
  // *and* maps its rejection onto PROFILE_005, which a plain `FileInterceptor`
  // would surface as a codeless 413.
  @UseInterceptors(AvatarFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload the current user’s avatar' })
  @ApiResponse({ status: 201, type: ProfileResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Profile not found',
    code: 'PROFILE_001',
  })
  @ApiProblemResponse({
    status: 415,
    description: 'Unsupported image type',
    code: 'PROFILE_004',
  })
  @ApiProblemResponse({
    status: 413,
    description: 'Image too large',
    code: 'PROFILE_005',
  })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ProfileResponseDto> {
    if (!file) {
      // No file part at all. Reported as an unsupported type rather than a
      // validation failure: `invalidParams` describes rejected *fields*, and a
      // missing multipart part is not one.
      throw new AppError(ProfileErrors.UNSUPPORTED_IMAGE_TYPE, {
        detail: 'No file was uploaded under the `file` field.',
      });
    }

    await this.commandBus.execute(
      new UploadAvatarCommand({
        userId,
        buffer: file.buffer,
        mimeType: file.mimetype,
        size: file.size,
      }),
    );

    const user = await this.queryBus.execute(new GetProfileQuery(userId));
    return this.mapper.toProfileResponse(user, await this.avatars.resolveUrl(user.avatarUrl));
  }
}
