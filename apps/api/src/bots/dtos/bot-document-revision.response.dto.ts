import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_AUTHORS,
  BOT_DOCUMENT_NAMES,
  type BotAuthor,
  type BotDocumentName,
} from '@oppenheimer/shared';

export class BotDocumentRevisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOT_DOCUMENT_NAMES })
  name!: BotDocumentName;

  @ApiProperty({ description: 'Revision 1 is the one the bot was created with.', example: 2 })
  revision!: number;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: BOT_AUTHORS })
  author!: BotAuthor;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  authorUserId!: string | null;

  @ApiProperty({ description: 'What the writer said about the change; may be empty.' })
  note!: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'The revision whose content this one restored, when it is a revert.',
  })
  revertedFrom!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
