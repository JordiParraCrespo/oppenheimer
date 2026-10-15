import { ApiProperty } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  BOT_AVATAR_COLORS,
  BOT_PERMISSIONS,
  BOT_PROVIDERS,
  type BotAvatarColor,
  type BotPermission,
  type BotProvider,
} from '@oppenheimer/shared';
import { SESSION_EFFORTS, type SessionEffort } from '@oppenheimer/shared/agents';

export class BotResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'New Bot' })
  name!: string;

  @ApiProperty({ example: 'Keeps the release notes honest.' })
  description!: string;

  @ApiProperty({
    enum: BOT_AVATAR_COLORS,
    description: 'The colour its initials are drawn on.',
  })
  avatarColor!: BotAvatarColor;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Its sidebar group; null is ungrouped.',
  })
  groupId!: string | null;

  @ApiProperty({ description: 'Its order inside its group, from 0.' })
  position!: number;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'The host its turns run on; null until one is chosen.',
  })
  homeHostId!: string | null;

  @ApiProperty({ enum: BOT_PROVIDERS, description: 'Who answers it, and so which engine runs.' })
  provider!: BotProvider;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "A model id the provider offers; null runs the provider's default.",
  })
  model!: string | null;

  @ApiProperty({
    ...nullableEnum(SESSION_EFFORTS),
    description: "The effort level; null runs the model at its own default.",
  })
  effort!: SessionEffort | null;

  @ApiProperty({ enum: BOT_PERMISSIONS, description: 'How far a turn may go without asking.' })
  permission!: BotPermission;

  @ApiProperty({ description: 'Whether what it decides to remember is saved without asking.' })
  learnAutomatically!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When it last changed; from the chat slice, its last message.',
  })
  lastActivityAt!: string;
}
