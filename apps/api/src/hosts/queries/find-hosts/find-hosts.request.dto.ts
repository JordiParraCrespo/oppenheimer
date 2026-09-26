import { listHostsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindHostsRequest extends createZodDto(listHostsQuerySchema) {}
