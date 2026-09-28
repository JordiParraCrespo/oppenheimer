import { createOrganizationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateOrganizationRequest extends createZodDto(createOrganizationSchema) {}
