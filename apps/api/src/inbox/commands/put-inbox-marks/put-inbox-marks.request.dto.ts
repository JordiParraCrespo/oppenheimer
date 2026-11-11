import { putInboxMarksSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PutInboxMarksRequest extends createZodDto(putInboxMarksSchema) {}
