import { createTaskSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateTaskRequest extends createZodDto(createTaskSchema) {}
