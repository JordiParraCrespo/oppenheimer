import { ApiProperty } from '@nestjs/swagger';
import { SESSION_FILE_MAX_BYTES, SESSION_FILE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';

/** A file waiting for the `POST /sessions` that names it in `attachmentIds`. */
export class SessionAttachmentResponseDto {
  @ApiProperty({ format: 'uuid', description: 'What `attachmentIds` names it by.' })
  id!: string;

  @ApiProperty({
    enum: SESSION_FILE_MEDIA_TYPES,
    description:
      'What the bytes are (magic bytes, or text that is only text), never the label the browser gave them.',
  })
  mediaType!: (typeof SESSION_FILE_MEDIA_TYPES)[number];

  @ApiProperty({ minimum: 1, maximum: SESSION_FILE_MAX_BYTES, description: 'Bytes.' })
  size!: number;
}
