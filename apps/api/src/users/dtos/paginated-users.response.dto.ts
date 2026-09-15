import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user.response.dto';

/** Where the caller is in the result set. */
export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total matching records, across all pages.',
    example: 42,
  })
  total!: number;

  @ApiProperty({ description: '1-based page number.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Records per page.', example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
