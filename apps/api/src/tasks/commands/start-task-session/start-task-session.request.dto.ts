import { startTaskSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartTaskSessionRequest extends createZodDto(startTaskSessionSchema) {}
