import { paginationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindAccessGrantsRequest extends createZodDto(paginationSchema) {}
