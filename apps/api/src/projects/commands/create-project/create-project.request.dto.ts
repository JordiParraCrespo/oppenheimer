import { createProjectSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateProjectRequest extends createZodDto(createProjectSchema) {}
