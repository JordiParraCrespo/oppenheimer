import { ApiProperty } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  BOT_PERMISSION_RULE_EFFECTS,
  BOT_PERMISSIONS,
  BOT_TOOL_DECISIONS,
  BOT_TOOL_GROUPS,
  type BotPermission,
  type BotPermissionRuleEffect,
  type BotToolDecision,
  type BotToolGroup,
} from '@oppenheimer/shared';

/** One tool, as Settings → Permissions lists it. */
export class BotToolPermissionDto {
  @ApiProperty({ description: 'The tool, as the bot knows it (`merge_pull_request`).' })
  name!: string;

  @ApiProperty({ enum: BOT_TOOL_GROUPS, description: 'The group it is listed under.' })
  group!: BotToolGroup;

  @ApiProperty({ description: 'What it does, in a sentence.' })
  description!: string;

  @ApiProperty({
    description: 'It reaches outside Oppenheimer: asking is its default under Approve for me.',
  })
  asks!: boolean;

  @ApiProperty({ description: 'Every call is decided on its own: Allow is not offered for it.' })
  perCallOnly!: boolean;

  @ApiProperty({
    enum: BOT_TOOL_DECISIONS,
    description: 'What it does now: the setting, or the default.',
  })
  decision!: BotToolDecision;

  @ApiProperty({
    ...nullableEnum(BOT_TOOL_DECISIONS),
    description: 'The owner’s setting; null when the tool follows the preset.',
  })
  set!: BotToolDecision | null;
}

/** A standing yes for every call of one tool on one thing. */
export class BotToolGrantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  tool!: string;

  @ApiProperty({ description: 'What it covers: `repository`, `session`.' })
  subjectKind!: string;

  @ApiProperty({ description: 'How it is named: `acme/xrp-mobile`.' })
  subjectLabel!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** A plain-language rule the reviewer reads before an asking call. */
export class BotPermissionRuleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOT_PERMISSION_RULE_EFFECTS })
  effect!: BotPermissionRuleEffect;

  @ApiProperty()
  text!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** What a bot may do, tool by tool, and the rules over it (`25-bots.md` §5). */
export class BotPermissionsResponseDto {
  @ApiProperty({
    enum: BOT_PERMISSIONS,
    description: 'The preset every tool with no setting follows.',
  })
  preset!: BotPermission;

  @ApiProperty({ type: [BotToolPermissionDto] })
  tools!: BotToolPermissionDto[];

  @ApiProperty({ type: [BotToolGrantDto], description: 'Newest first.' })
  grants!: BotToolGrantDto[];

  @ApiProperty({ type: [BotPermissionRuleDto], description: 'Oldest first.' })
  rules!: BotPermissionRuleDto[];
}
