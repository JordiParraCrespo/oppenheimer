import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One folder the search found. */
export class HostFoundFolderResponseDto {
  @ApiProperty({
    description: 'Its absolute path on the host.',
    example: '/home/jordi/code/acme/billing',
  })
  path!: string;

  @ApiPropertyOptional({
    description: 'The branch its checkout is on, when it is a git repository.',
    nullable: true,
    type: String,
    example: 'main',
  })
  branch!: string | null;
}

/**
 * The folder picker's search (`product/versions/mvp/24-session-places.md` §4):
 * the folders under the host's home whose name holds what was typed, as its
 * runner found them just now, best match first.
 */
export class HostFolderSearchResponseDto {
  @ApiProperty({ description: 'The directory searched under.', example: '/home/jordi' })
  path!: string;

  @ApiProperty({
    description: 'The home directory of the user the runner runs as, so a client can show `~`.',
    example: '/home/jordi',
  })
  home!: string;

  @ApiProperty({ type: [HostFoundFolderResponseDto] })
  entries!: HostFoundFolderResponseDto[];

  @ApiProperty({
    description:
      'The search stopped at its bounds or found more than `entries` carries: a longer name narrows it.',
  })
  truncated!: boolean;
}
