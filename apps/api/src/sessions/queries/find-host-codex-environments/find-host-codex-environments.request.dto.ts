import { hostCodexEnvironmentsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindHostCodexEnvironmentsRequest extends createZodDto(
  hostCodexEnvironmentsQuerySchema,
) {}
