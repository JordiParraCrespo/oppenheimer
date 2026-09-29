import { ApiProperty } from '@nestjs/swagger';
import { SESSION_IMAGE_MAX_BYTES, SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';

/** An image waiting for the `POST /sessions` that names it in `attachmentIds`. */
export class SessionAttachmentResponseDto {
  @ApiProperty({ format: 'uuid', description: 'What `attachmentIds` names it by.' })
  id!: string;

  @ApiProperty({
    enum: SESSION_IMAGE_MEDIA_TYPES,
    description: 'What the bytes are by their magic bytes, never the label the browser gave them.',
  })
  mediaType!: (typeof SESSION_IMAGE_MEDIA_TYPES)[number];

  @ApiProperty({ minimum: 1, maximum: SESSION_IMAGE_MAX_BYTES, description: 'Bytes.' })
  size!: number;
}
