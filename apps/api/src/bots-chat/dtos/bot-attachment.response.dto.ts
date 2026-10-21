import { ApiProperty } from '@nestjs/swagger';
import { BOT_IMAGE_MIME_TYPES, type BotImageMimeType } from '@oppenheimer/shared';

/** An image in a bot's chat: picked in the composer, or carried by a message of yours. */
export class BotAttachmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOT_IMAGE_MIME_TYPES })
  mimeType!: BotImageMimeType;

  @ApiProperty({ description: 'Its size in bytes.' })
  sizeBytes!: number;

  @ApiProperty({ description: 'The file name it was uploaded with; may be empty.' })
  name!: string;
}
