import { ApiProperty } from '@nestjs/swagger';

export class DesktopTicketResponseDto {
  @ApiProperty({
    description:
      'Single-use, 60 seconds. Present it in `Sec-WebSocket-Protocol` when opening the desktop socket — never in the URL.',
  })
  ticket!: string;

  @ApiProperty({
    description: 'The path to open the WebSocket on, on this API’s own origin.',
    example: '/api/v1/relay/desktop',
  })
  url!: string;

  @ApiProperty()
  expiresAt!: Date;
}
