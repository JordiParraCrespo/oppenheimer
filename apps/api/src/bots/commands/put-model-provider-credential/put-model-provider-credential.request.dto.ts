import { putModelProviderCredentialSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PutModelProviderCredentialRequest extends createZodDto(
  putModelProviderCredentialSchema,
) {}
