import { ApiProperty } from '@nestjs/swagger';
import { WHATSAPP_ACCOUNT_STATUSES, type WhatsappAccountStatus } from '@oppenheimer/shared';

/** One of the caller's linked WhatsApp numbers, as Settings lists it. Never its keys: the host keeps them. */
export class WhatsappAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The host whose runner holds the linked device.' })
  hostId!: string;

  @ApiProperty({ example: 'Spare', description: 'What the person and their bots call the number.' })
  label!: string;

  @ApiProperty({
    enum: WHATSAPP_ACCOUNT_STATUSES,
    description:
      'The device as its host last reported it: `pairing` shows a QR code to scan, `connected` is online, `logged_out` and `unlinked` offer Pair again.',
  })
  status!: WhatsappAccountStatus;

  @ApiProperty({
    description: 'Whether the host’s runner is connected now; nothing moves while it is not.',
  })
  hostOnline!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '34600111222@s.whatsapp.net',
    description: 'The paired number’s JID, once paired.',
  })
  phone!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The paired account’s own WhatsApp name.',
  })
  displayName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'While pairing, the QR code’s text, to draw and scan from the phone’s Linked devices.',
  })
  qr!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  qrExpiresAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the device is logged out or unlinked, in the host’s words.',
  })
  statusReason!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first linked.' })
  linkedAt!: string;
}
