import type { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The `{ data, meta }` wrapper of a paginated response, as a base class for the
 * module's own DTO:
 *
 * ```ts
 * export class PaginatedUsersResponseDto extends PaginatedResponseDto(
 *   UserResponseDto,
 *   PaginationMetaDto,
 * ) {}
 * ```
 *
 * The subclass keeps its name, so the OpenAPI component and the generated
 * client's type stay the module's; only the two properties are shared.
 */
export function PaginatedResponseDto<Item, Meta>(item: Type<Item>, meta: Type<Meta>) {
  abstract class PaginatedResponse {
    @ApiProperty({ type: [item] })
    data!: Item[];

    @ApiProperty({ type: meta })
    meta!: Meta;
  }
  return PaginatedResponse;
}
