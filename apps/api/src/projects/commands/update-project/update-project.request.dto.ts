import { updateProjectSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateProjectRequest extends createZodDto(updateProjectSchema) {}
