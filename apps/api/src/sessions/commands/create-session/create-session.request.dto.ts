import { createSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateSessionRequest extends createZodDto(createSessionSchema) {}
