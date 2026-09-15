import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

const schema = z.object({
  host: z.string().default('localhost'),
  port: z.coerce.number().default(5432),
  username: z.string().default('oppenheimer'),
  password: z.string().default('oppenheimer'),
  database: z.string().default('oppenheimer'),
  // Off by default: query logging buries every other line under a wall of
  // SELECTs. Even when enabled, bound parameters are never logged — see
  // `TypeOrmQueryLogger`.
  logQueries: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export const databaseConfig = registerAs('database', () =>
  parseEnv('database', schema, {
    host: 'DB_HOST',
    port: 'DB_PORT',
    username: 'DB_USERNAME',
    password: 'DB_PASSWORD',
    database: 'DB_DATABASE',
    logQueries: 'DB_LOG_QUERIES',
  }),
);
