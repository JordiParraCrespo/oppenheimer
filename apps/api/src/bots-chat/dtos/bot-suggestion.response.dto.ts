import { ApiProperty } from '@nestjs/swagger';

/** `GET /bots/:id/suggestion`. */
export class BotSuggestionResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "The person's likely next message, offered in the composer; null when there is none to offer.",
  })
  suggestion!: string | null;
}
