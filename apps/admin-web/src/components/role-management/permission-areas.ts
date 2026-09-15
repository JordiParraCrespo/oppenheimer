import {
  Building2,
  CreditCard,
  FileClock,
  KeyRound,
  UserRound,
  Users,
} from '@oppenheimer/design-system-web/icons';
import type { RoleEditorDto } from '@oppenheimer/shared/schemas/role';

/**
 * The permission model the role editor is drawn from: a handful of areas, each
 * a set of CASL subjects, and the three levels a role can hold over one.
 *
 * The subjects are the ones the API's controllers check (`KNOWN_SUBJECTS` in
 * `@oppenheimer/shared/permissions`); a new resource joins an area here or gets one
 * of its own, or the editor cannot grant it.
 */
export type PermissionLevel = 'none' | 'view' | 'edit';
export type PermissionAreaKey = 'team' | 'organization' | 'users' | 'api' | 'billing' | 'audit';

export const PERMISSION_AREAS: Array<{
  key: PermissionAreaKey;
  icon: typeof Users;
  subjects: string[];
}> = [
  { key: 'team', icon: Users, subjects: ['Member', 'Invitation', 'Role'] },
  { key: 'organization', icon: Building2, subjects: ['Organization', 'Workspace'] },
  { key: 'users', icon: UserRound, subjects: ['User'] },
  { key: 'api', icon: KeyRound, subjects: ['ApiToken'] },
  { key: 'billing', icon: CreditCard, subjects: ['Billing'] },
  { key: 'audit', icon: FileClock, subjects: ['AuditLog'] },
];

export function permissionLevel(
  permissions: RoleEditorDto['permissions'],
  subjects: string[],
): PermissionLevel {
  const matching = permissions.filter((permission) => subjects.includes(permission.subject));
  if (matching.length === 0) return 'none';
  return matching.some((permission) => permission.action !== 'read') ? 'edit' : 'view';
}
