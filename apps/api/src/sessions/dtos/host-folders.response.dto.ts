import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One sub-directory of the listed folder. */
export class HostFolderEntryResponseDto {
  @ApiProperty({ description: 'The directory’s name.', example: 'xrp-mobile' })
  name!: string;

  @ApiProperty({
    description: 'Its absolute path on the host: the listed folder joined with the name.',
    example: '/home/jordi/code/xrp-mobile',
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

/** A folder the caller started sessions in on this host before. */
export class HostRecentFolderResponseDto {
  @ApiProperty({ description: 'Its absolute path on the host.', example: '/home/jordi/notes' })
  path!: string;

  @ApiProperty({ description: 'When the caller last started a session in it.' })
  lastUsedAt!: Date;
}

/**
 * One directory on a host for the folder picker
 * (`product/versions/mvp/24-session-places.md` §4): its sub-directories as the
 * runner listed them just now — names only, never files, hidden ones left out —
 * and the caller's recent folders on the host, from the API's own rows.
 */
export class HostFoldersResponseDto {
  @ApiProperty({
    description: 'The directory listed, absolute and cleaned.',
    example: '/home/jordi/code',
  })
  path!: string;

  @ApiPropertyOptional({
    description: 'Its parent; null at the root.',
    nullable: true,
    type: String,
    example: '/home/jordi',
  })
  parent!: string | null;

  @ApiProperty({
    description: 'The home directory of the user the runner runs as, so a client can show `~`.',
    example: '/home/jordi',
  })
  home!: string;

  @ApiPropertyOptional({
    description: 'The listed directory’s own branch, when it is a git repository.',
    nullable: true,
    type: String,
  })
  branch!: string | null;

  @ApiProperty({ type: [HostFolderEntryResponseDto] })
  entries!: HostFolderEntryResponseDto[];

  @ApiProperty({ description: 'More directories were there than `entries` carries.' })
  truncated!: boolean;

  @ApiProperty({
    type: [HostRecentFolderResponseDto],
    description:
      'The folders of the caller’s own folder sessions on this host, newest first, at most eight.',
  })
  recent!: HostRecentFolderResponseDto[];
}
