import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

// Everything here is optional-capability config: with no S3 settings the app
// stores files on local disk. The S3 keys are genuinely optional — a blank or
// whitespace-only env var normalizes to undefined so the capability registry
// never reports S3 as configured on unusable credentials.
const schema = z.object({
  provider: z.enum(['local', 's3']).default('local'),
  uploadDir: z.string().default('./uploads'),
  // Absolute base the browser uses to load locally-stored files, so a stored
  // avatar resolves against the API regardless of where the SPA is hosted — the
  // documented Tier-1 serves the web app from a different origin (Vercel /
  // Cloudflare Pages) than the API. Defaults to the API's own public URL
  // (BETTER_AUTH_URL); set STORAGE_PUBLIC_URL only if local files are fronted by
  // a separate host/CDN. Unused by the S3 backend, which signs absolute URLs.
  publicUrl: z.string().url().optional(),
  s3Endpoint: z.string().optional(),
  s3Region: z.string().default('auto'),
  s3Bucket: z.string().default('oppenheimer'),
  s3AccessKeyId: z.string().optional(),
  s3SecretAccessKey: z.string().optional(),
});

export const storageConfig = registerAs('storage', () => {
  const config = parseEnv('storage', schema, {
    provider: 'STORAGE_PROVIDER',
    uploadDir: 'UPLOAD_DIR',
    publicUrl: 'STORAGE_PUBLIC_URL',
    s3Endpoint: 'S3_ENDPOINT',
    s3Region: 'S3_REGION',
    s3Bucket: 'S3_BUCKET',
    s3AccessKeyId: 'S3_ACCESS_KEY_ID',
    s3SecretAccessKey: 'S3_SECRET_ACCESS_KEY',
  });

  return {
    ...config,
    // Fall back to the API's own public URL. `BETTER_AUTH_URL` is the one
    // canonical "where this API is reachable" value the deployment already sets,
    // and it shares the same dev default, so local files need no extra config.
    publicUrl: config.publicUrl ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  };
});
