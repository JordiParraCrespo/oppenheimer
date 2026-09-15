import { createApiTokenSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateApiTokenRequest extends createZodDto(createApiTokenSchema) {}
