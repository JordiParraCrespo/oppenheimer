import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_CHANGE_STATUSES,
  SESSION_CHANGES_SCOPES,
  type SessionChangesScope,
} from '@oppenheimer/shared/protocol';

type ChangeStatus = (typeof SESSION_CHANGE_STATUSES)[number];

export class SessionChangedFileDto {
  @ApiProperty({ description: 'Relative to the checkout’s root, `/`-separated.' })
  path!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Where a renamed or copied file came from.',
  })
  oldPath!: string | null;

  @ApiProperty({
    enum: SESSION_CHANGE_STATUSES,
    description: '`untracked` is new and never added to git.',
  })
  status!: ChangeStatus;

  @ApiProperty({ description: 'Lines added; 0 for a binary file.' })
  additions!: number;

  @ApiProperty({ description: 'Lines removed; 0 for a binary file.' })
  deletions!: number;

  @ApiProperty()
  binary!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The file’s unified diff from its `diff --git` line; null when binary or left out.',
  })
  patch!: string | null;

  @ApiProperty({
    description: 'The patch was left out: too long for one read, or not read in time.',
  })
  patchOmitted!: boolean;
}

export class SessionCheckoutChangesDto {
  @ApiProperty({ description: '`owner/name`.' })
  repository!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  checkoutId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What the session’s branch was cut from.',
  })
  baseBranch!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The commit compared with; null when the branch has no commit yet.',
  })
  base!: string | null;

  @ApiProperty({
    description:
      'The branch’s history did not reach its base yet (the host is still fetching it), so the base branch’s tip stood in: what the base gained since shows reversed.',
  })
  approximate!: boolean;

  @ApiProperty({ type: [SessionChangedFileDto] })
  files!: SessionChangedFileDto[];

  @ApiProperty({ description: 'Files past the bound of one read, counted and left out.' })
  omittedFiles!: number;

  @ApiProperty({ description: 'Lines added across `files`.' })
  additions!: number;

  @ApiProperty({ description: 'Lines removed across `files`.' })
  deletions!: number;
}

export class SessionChangesResponseDto {
  @ApiProperty({
    enum: ['listed', 'host_offline', 'not_supported'],
    description:
      '`listed`: `checkouts` is what the host read now. `host_offline`: the host has no link. `not_supported`: its runner cannot read changes, or the session is not on it.',
  })
  state!: 'listed' | 'host_offline' | 'not_supported';

  @ApiProperty({ enum: SESSION_CHANGES_SCOPES })
  scope!: SessionChangesScope;

  @ApiProperty({
    type: [SessionCheckoutChangesDto],
    description: 'One entry per checkout, the first checkout first; none for a folder session.',
  })
  checkouts!: SessionCheckoutChangesDto[];
}
