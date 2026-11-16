import { openSessionWindowBodySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class OpenSessionWindowRequest extends createZodDto(openSessionWindowBodySchema) {}
