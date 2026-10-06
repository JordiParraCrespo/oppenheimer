import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const LiveErrors = {
  UNAVAILABLE: {
    code: 'LIVE_001',
    message: 'The live stream is unavailable',
    httpStatus: 503,
  },
  NO_WORKSPACE: {
    code: 'LIVE_002',
    message: 'The live stream belongs to a workspace',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
