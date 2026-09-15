import { createLeadSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateLeadRequest extends createZodDto(createLeadSchema) {}
