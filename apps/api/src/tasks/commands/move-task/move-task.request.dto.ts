import { moveTaskSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class MoveTaskRequest extends createZodDto(moveTaskSchema) {}
