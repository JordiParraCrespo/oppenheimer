import { NAV, type NavItem } from '@/components/app-shell/nav';

export function useAuthorizedNav(): readonly NavItem[] {
  return NAV;
}

export function useLandingRoute(): '/users' {
  return '/users';
}
