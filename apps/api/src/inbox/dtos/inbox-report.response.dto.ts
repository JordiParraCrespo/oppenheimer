import { ApiProperty } from '@nestjs/swagger';
import {
  INBOX_REPORT_IMAGE_MIME_TYPES,
  INBOX_REPORT_STATUSES,
  type InboxReportImageMimeType,
  type InboxReportStatus,
} from '@oppenheimer/shared';

/** A picture a report carries; its bytes are read at `…/images/:imageId/content`. */
export class InboxReportImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: INBOX_REPORT_IMAGE_MIME_TYPES, description: 'Judged by the file’s bytes.' })
  mimeType!: InboxReportImageMimeType;

  @ApiProperty({ type: 'integer' })
  sizeBytes!: number;

  @ApiProperty({ description: 'The file’s name as it was sent; only shown.' })
  name!: string;
}

/** A report sent to the workspace's Inbox, and the answer once it has one. */
export class InboxReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Empty when the report has none.' })
  body!: string;

  @ApiProperty({ description: 'Who sent it, in the sender’s own words; empty when not said.' })
  source!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uri',
    description: 'Where the problem can be seen.',
  })
  link!: string | null;

  @ApiProperty({ type: InboxReportImageResponseDto, isArray: true })
  images!: InboxReportImageResponseDto[];

  @ApiProperty({ enum: INBOX_REPORT_STATUSES })
  status!: InboxReportStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the person answered; null while the report is open.',
  })
  answer!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  answeredAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
