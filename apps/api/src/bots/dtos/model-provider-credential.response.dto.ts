import { ApiProperty } from '@nestjs/swagger';
import { BOT_PROVIDERS, type BotProvider } from '@oppenheimer/shared';

/** One provider's key as the console sees it: whether there is one, never what it is. */
export class ModelProviderCredentialResponseDto {
  @ApiProperty({ enum: BOT_PROVIDERS })
  provider!: BotProvider;

  @ApiProperty({ description: 'Whether the workspace has a key for this provider.' })
  configured!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The key's last four characters, so a person can tell which one is stored.",
  })
  keyHint!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  updatedAt!: string | null;

  @ApiProperty({
    description:
      'Whether a new bot starts on this provider: the one the workspace marked, else the key it stored first, else Anthropic. Exactly one row is.',
  })
  isDefault!: boolean;
}
