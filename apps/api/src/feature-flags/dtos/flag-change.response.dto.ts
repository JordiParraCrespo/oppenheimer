import { ApiProperty } from '@nestjs/swagger';

export class FlagChangeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['flag', 'segment'] })
  subjectType!: 'flag' | 'segment';

  @ApiProperty()
  subjectKey!: string;

  @ApiProperty({
    enum: ['targeting_updated', 'toggled', 'segment_created', 'segment_updated', 'segment_deleted'],
  })
  action!: string;

  @ApiProperty({ nullable: true, type: String })
  actorId!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Why, in the author’s words.' })
  comment!: string | null;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  before!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  after!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}

class FlagChangePaginationMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedFlagChangesResponseDto {
  @ApiProperty({ type: [FlagChangeResponseDto] })
  data!: FlagChangeResponseDto[];

  @ApiProperty({ type: FlagChangePaginationMetaDto })
  meta!: FlagChangePaginationMetaDto;
}
