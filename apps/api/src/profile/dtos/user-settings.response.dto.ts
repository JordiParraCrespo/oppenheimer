import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, TABLE_DENSITIES, THEMES } from '@oppenheimer/shared';

/**
 * A user's workspace preferences. Returned with the defaults filled in when the
 * user has never saved any, so a client never has to decide what "unset" means.
 */
export class UserSettingsResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: THEMES })
  theme!: (typeof THEMES)[number];

  @ApiProperty({ enum: LOCALES })
  locale!: (typeof LOCALES)[number];

  @ApiProperty({ enum: TABLE_DENSITIES })
  density!: (typeof TABLE_DENSITIES)[number];

  @ApiProperty()
  weeklyDigest!: boolean;

  @ApiProperty()
  productUpdates!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
