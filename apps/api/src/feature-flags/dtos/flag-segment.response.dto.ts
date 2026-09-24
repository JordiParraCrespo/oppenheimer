import { ApiProperty } from '@nestjs/swagger';
import { FlagConditionDto } from './feature-flag.response.dto';

export class FlagSegmentResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ type: [FlagConditionDto], description: 'ANDed.' })
  conditions!: FlagConditionDto[];

  @ApiProperty({ type: [String], description: 'Flags whose rules target this segment.' })
  usedBy!: string[];

  @ApiProperty({ nullable: true, type: String })
  updatedBy!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}
