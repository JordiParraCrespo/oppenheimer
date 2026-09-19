import { closeSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CloseSessionRequest extends createZodDto(closeSessionSchema) {}
