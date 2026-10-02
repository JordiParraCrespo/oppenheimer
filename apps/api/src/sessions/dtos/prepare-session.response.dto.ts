import { ApiProperty } from '@nestjs/swagger';

export class PrepareSessionResponseDto {
  @ApiProperty({
    description:
      'Why the host was not told: `host_offline` (no live link) or `not_supported` (a runner older than the prepare). Empty when it was.',
    type: [String],
    example: [],
  })
  hints!: string[];
}
