import { putCloudAgentCredentialSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PutCloudAgentCredentialRequest extends createZodDto(putCloudAgentCredentialSchema) {}
