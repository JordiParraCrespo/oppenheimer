import { putModelProviderCredentialSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

/** The key, sealed before it is stored and never read back. */
export class ReplaceModelProviderKeyRequest extends createZodDto(
  putModelProviderCredentialSchema,
) {}
