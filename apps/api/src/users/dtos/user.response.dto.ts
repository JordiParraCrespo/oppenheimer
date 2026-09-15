import { ApiProperty } from '@nestjs/swagger';
import type { Role } from '@oppenheimer/shared';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  role!: Role;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
