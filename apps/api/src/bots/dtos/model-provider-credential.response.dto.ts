import { ApiProperty } from '@nestjs/swagger';
import { MODEL_PROVIDERS, type ModelProvider } from '@oppenheimer/shared';

/** One of a provider's keys as the console sees it: its last characters, never the key. */
export class ModelProviderKeyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: "The key's last four characters, so a person can tell which one it is.",
  })
  keyHint!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description:
      'When a call on it was refused because the account behind it is out of credit or quota; null while it is not known to be spent. Calls move on to the next key, and come back to a spent one only once every key is spent.',
  })
  spentAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

/** One provider's keys as the console sees them: whether there are any, never what they are. */
export class ModelProviderCredentialResponseDto {
  @ApiProperty({ enum: MODEL_PROVIDERS })
  provider!: ModelProvider;

  @ApiProperty({ description: 'Whether the workspace has a key for this provider.' })
  configured!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The first key's last four characters, so a person can tell which one is stored.",
  })
  keyHint!: string | null;

  @ApiProperty({
    type: [ModelProviderKeyResponseDto],
    description:
      'Every key stored for the provider, in the order a call tries them while none is spent. A sign-in is one.',
  })
  keys!: ModelProviderKeyResponseDto[];

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  updatedAt!: string | null;

  @ApiProperty({
    description:
      'Whether a new bot starts on this provider: the one the workspace marked, else the key it stored first, else Anthropic. Exactly one row is.',
  })
  isDefault!: boolean;
}
