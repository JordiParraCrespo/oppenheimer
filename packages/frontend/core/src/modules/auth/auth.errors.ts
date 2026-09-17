import type { ErrorDefinition } from '../core/errors';

export const AuthErrors = {
  LOGIN_FAILED: {
    code: 'AUTH_CLIENT_001',
    message: 'Login failed',
  },
  REGISTER_FAILED: {
    code: 'AUTH_CLIENT_002',
    message: 'Registration failed',
  },
  REFRESH_FAILED: {
    code: 'AUTH_CLIENT_003',
    message: 'Token refresh failed',
  },
} as const satisfies Record<string, ErrorDefinition>;
