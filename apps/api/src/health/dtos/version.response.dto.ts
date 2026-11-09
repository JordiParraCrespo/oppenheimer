import { ApiProperty } from '@nestjs/swagger';
import type { ApiVersion } from '@oppenheimer/shared';

export class VersionResponseDto implements ApiVersion {
  @ApiProperty({
    description: 'The release this API runs, as in its package.json.',
    example: '0.3.0',
  })
  version!: string;
}
