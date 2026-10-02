import { prepareSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PrepareSessionRequest extends createZodDto(prepareSessionSchema) {}
