import { updateTaskSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateTaskRequest extends createZodDto(updateTaskSchema) {}
