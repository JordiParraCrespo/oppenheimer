import { ApiProperty } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  BOT_AVATAR_COLORS,
  BOT_FACE_EYES,
  BOT_FACE_HATS,
  BOT_FACE_MOUTHS,
  BOT_PERMISSIONS,
  BOT_PROVIDERS,
  BOT_SECTIONS,
  type BotAvatarColor,
  type BotFace,
  type BotPermission,
  type BotProvider,
  type BotSection,
} from '@oppenheimer/shared';
import { SESSION_EFFORTS, type SessionEffort } from '@oppenheimer/shared/agents';

/** The face a bot's owner picked: its hat, eyes and mouth. */
export class BotFaceDto {
  @ApiProperty({ enum: BOT_FACE_HATS })
  hat!: BotFace['hat'];

  @ApiProperty({ enum: BOT_FACE_EYES })
  eyes!: BotFace['eyes'];

  @ApiProperty({ enum: BOT_FACE_MOUTHS })
  mouth!: BotFace['mouth'];
}

export class BotResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Juno' })
  name!: string;

  @ApiProperty({ example: 'Keeps the release notes honest.' })
  description!: string;

  @ApiProperty({
    enum: BOT_AVATAR_COLORS,
    description: 'The colour its face is drawn in.',
  })
  avatarColor!: BotAvatarColor;

  @ApiProperty({
    type: BotFaceDto,
    nullable: true,
    description: 'The face its owner picked; null wears the one its id picks.',
  })
  avatarFace!: BotFaceDto | null;

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
    description: 'The effort level; null runs the model at its own default.',
  })
  effort!: SessionEffort | null;

  @ApiProperty({ enum: BOT_PERMISSIONS, description: 'How far a turn may go without asking.' })
  permission!: BotPermission;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'The bot that created it (`create_bot`); null when it was made in the console, or once that bot is deleted.',
  })
  createdByBotId!: string | null;

  @ApiProperty({ description: 'Whether what it decides to remember is saved without asking.' })
  learnAutomatically!: boolean;

  @ApiProperty({
    description:
      'Whether its routines pause while its owner is away from its chat, and start again when they are back.',
  })
  routineSpendGuard!: boolean;

  @ApiProperty({
    enum: BOT_SECTIONS,
    isArray: true,
    description:
      'The console sections whose sidebar lists it beside Employees, in catalog order; empty shows it in Employees only.',
  })
  sections!: BotSection[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Its last message, or when it last changed before it had one.',
  })
  lastActivityAt!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The start of its last message, for the sidebar; null before the first.',
  })
  lastMessagePreview!: string | null;
}
