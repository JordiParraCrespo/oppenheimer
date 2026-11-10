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

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The caller’s Oppenheimer bot that answers them on this number by default; null while none does. "Name: …" in the chat switches to another of their bots.',
  })
  answeringBotId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '+34600111222',
    description:
      'The owner’s own number, confirmed by the code it received; the only number this one answers. Null until confirmed.',
  })
  ownerNumber!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '+34600111222',
    description: 'The number a code was sent to, waiting for the code to be entered.',
  })
  ownerPendingNumber!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the waiting code stops working.',
  })
  ownerCodeExpiresAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first linked.' })
  linkedAt!: string;
}
