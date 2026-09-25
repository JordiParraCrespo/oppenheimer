import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FLAG_ATTRIBUTES,
  FLAG_BUCKET_UNITS,
  FLAG_KINDS,
  FLAG_OPERATORS,
  FLAG_REASONS,
  type FlagAttribute,
  type FlagBucketUnit,
  type FlagKind,
  type FlagOperator,
  type FlagReason,
  type FlagValue,
} from '@oppenheimer/shared/feature-flags';

/** A flag value: a boolean, or the name of a variant. */
const FLAG_VALUE_SCHEMA = { oneOf: [{ type: 'boolean' }, { type: 'string' }] };

export class FlagConditionDto {
  @ApiProperty({ enum: FLAG_ATTRIBUTES })
  attribute!: FlagAttribute;

  @ApiProperty({ enum: FLAG_OPERATORS })
  operator!: FlagOperator;

  @ApiProperty({ type: [String] })
  values!: string[];
}

export class FlagSplitArmDto {
  @ApiProperty(FLAG_VALUE_SCHEMA)
  value!: FlagValue;

  @ApiProperty({ description: 'Percentage of the audience, 0–100. The arms sum to 100.' })
  weight!: number;
}

/** Exactly one of `value` or `split` is present. */
export class FlagServeDto {
  @ApiPropertyOptional({
    ...FLAG_VALUE_SCHEMA,
    description: 'Serve one value to everyone reached.',
  })
  value?: FlagValue;

  @ApiPropertyOptional({
    type: [FlagSplitArmDto],
    description: 'Split the audience between values by a deterministic hash.',
  })
  split?: FlagSplitArmDto[];
}

export class FlagRuleDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: [FlagConditionDto], description: 'ANDed. Empty matches everyone.' })
  conditions!: FlagConditionDto[];

  @ApiProperty({ type: FlagServeDto })
  serve!: FlagServeDto;
}

/** A flag's targeting on this deployment. */
export class FeatureFlagConfigResponseDto {
  @ApiProperty({ description: 'The master switch. Off serves the default to everyone.' })
  enabled!: boolean;

  @ApiProperty({ type: [FlagRuleDto], description: 'Ordered; the first match decides.' })
  rules!: FlagRuleDto[];

  @ApiProperty({ type: FlagServeDto, description: 'Served when enabled and no rule matched.' })
  fallthrough!: FlagServeDto;

  @ApiProperty({ nullable: true, type: String })
  updatedBy!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}

/** A catalog flag, with its targeting on this deployment if any has been saved. */
export class FeatureFlagResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: FLAG_KINDS })
  kind!: FlagKind;

  @ApiProperty()
  owner!: string;

  @ApiProperty({ enum: ['boolean', 'variant'] })
  type!: 'boolean' | 'variant';

  @ApiProperty({
    type: [String],
    description: 'The values a variant flag takes; empty for a boolean flag.',
  })
  variants!: string[];

  @ApiProperty({
    ...FLAG_VALUE_SCHEMA,
    description: 'The safe value, served when nothing else decides.',
  })
  defaultValue!: FlagValue;

  @ApiProperty({ description: 'Whether clients may read it.' })
  client!: boolean;

  @ApiProperty({ enum: FLAG_BUCKET_UNITS })
  bucketBy!: FlagBucketUnit;

  @ApiProperty({ nullable: true, type: String, description: 'YYYY-MM-DD, for temporary flags.' })
  expiresAt!: string | null;

  @ApiProperty({ description: 'A temporary flag past its expiry date: remove it from the code.' })
  expired!: boolean;

  @ApiProperty({
    type: FeatureFlagConfigResponseDto,
    nullable: true,
    description: 'Null until targeting is first saved; the flag serves its default.',
  })
  config!: FeatureFlagConfigResponseDto | null;
}

export class FlagEvaluationResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty(FLAG_VALUE_SCHEMA)
  value!: FlagValue;

  @ApiProperty({ enum: FLAG_REASONS })
  reason!: FlagReason;

  @ApiPropertyOptional({ description: 'The rule that decided, when one did.' })
  ruleId?: string;
}

/** The caller's evaluated client flags. */
export class ClientFeatureFlagsResponseDto {
  @ApiProperty({ description: 'Changes whenever any flag or segment configuration does.' })
  version!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: FLAG_VALUE_SCHEMA,
    description: 'Every client flag, keyed by name.',
  })
  flags!: Record<string, FlagValue>;
}
