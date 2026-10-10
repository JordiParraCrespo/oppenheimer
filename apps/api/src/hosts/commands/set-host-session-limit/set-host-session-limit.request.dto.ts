import { setHostSessionLimitSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetHostSessionLimitRequest extends createZodDto(setHostSessionLimitSchema) {}
