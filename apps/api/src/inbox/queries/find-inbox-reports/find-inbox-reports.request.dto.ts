import { findInboxReportsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindInboxReportsRequest extends createZodDto(findInboxReportsSchema) {}
