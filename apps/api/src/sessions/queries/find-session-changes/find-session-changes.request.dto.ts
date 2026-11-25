import { listSessionChangesQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindSessionChangesRequest extends createZodDto(listSessionChangesQuerySchema) {}
