import { putInboxMarkSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PutInboxMarkRequest extends createZodDto(putInboxMarkSchema) {}
