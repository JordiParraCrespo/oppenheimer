import { apiTokens } from './api-tokens';
import { auth } from './auth';
import { authz } from './authz';
import { automations } from './automations';
import { featureFlags } from './feature-flags';
import { github } from './github';
import { hosts } from './hosts';
import { inboundEvents } from './inbound-events';
import { organizations } from './organizations';
import { outbox } from './outbox';
import { profile } from './profile';
import { projects } from './projects';
import { roles } from './roles';
import type { SchemaSlice } from './schema-slice';
import { sessions } from './sessions';
import { users } from './users';

export const EXTENSIONS = [
  'CREATE EXTENSION IF NOT EXISTS pg_trgm',
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
];

/** Every module's slice. Order does not matter: the foreign keys run after all the tables. */
export const SLICES: SchemaSlice[] = [
  apiTokens,
  auth,
  authz,
  automations,
  featureFlags,
  github,
  hosts,
  inboundEvents,
  organizations,
  outbox,
  profile,
  projects,
  roles,
  sessions,
  users,
];
