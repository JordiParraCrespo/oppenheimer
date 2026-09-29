import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/** Personal API tokens. **Defaulted.** */
const schema = z.object({
  /** Active (unrevoked, unexpired) tokens one user may hold at once. */
  maxActivePerUser: z.coerce.number().int().positive().default(50),
});

export const apiTokensConfig = registerAs('apiTokens', () =>
  parseEnv('apiTokens', schema, {
    maxActivePerUser: 'API_TOKENS_MAX_ACTIVE_PER_USER',
  }),
);
