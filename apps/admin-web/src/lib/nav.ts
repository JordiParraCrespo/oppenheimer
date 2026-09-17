import { type LucideIcon, Shield, Users } from '@oppenheimer/design-system-web/icons';
import type { Messages } from '@oppenheimer/translations/locales';

export interface NavItem {
  to: '/users' | '/roles';
  icon: LucideIcon;
  labelKey: keyof Messages['nav'];
}

export const NAV = [
  { to: '/users', icon: Users, labelKey: 'users' },
  { to: '/roles', icon: Shield, labelKey: 'roles' },
] as const satisfies readonly NavItem[];
