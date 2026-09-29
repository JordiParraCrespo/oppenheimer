import { updateOrganizationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateOrganizationRequest extends createZodDto(updateOrganizationSchema) {}
