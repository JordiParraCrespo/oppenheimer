import { ApiProperty } from '@nestjs/swagger';

export class ReportCloudStatusResponse {
  @ApiProperty({
    description: 'How many of the reported cloud sessions this workspace launched.',
    example: 1,
  })
  matched!: number;
}
