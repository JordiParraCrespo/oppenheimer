import { listProjectsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindProjectsRequest extends createZodDto(listProjectsQuerySchema) {}
