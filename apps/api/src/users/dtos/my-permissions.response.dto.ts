import { ApiProperty } from '@nestjs/swagger';
import type { PermissionDefinition } from '@oppenheimer/shared';

/**
 * The caller's own effective authorization, served so a client can gate its UI
 * (which routes to show in the sidebar) without waiting for each page's query
 * to 403. It is the union of every role assigned to the caller — the same set
 * the `PoliciesGuard` checks server-side — not what they may grant to others.
 */
export class MyPermissionsResponseDto {
  @ApiProperty({
    description: 'CASL permission rules the caller effectively holds.',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  permissions!: PermissionDefinition[];
}
