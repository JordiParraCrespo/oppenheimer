import { ApiProperty } from '@nestjs/swagger';

/** Response contract for a workspace (Better Auth team) inside an organization. */
export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true, type: Date })
  updatedAt!: Date | null;
}

/** A user's membership of a workspace. */
export class WorkspaceMemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  createdAt!: Date;
}
