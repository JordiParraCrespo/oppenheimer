import { findSharedSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindSharedSessionRequest extends createZodDto(findSharedSessionSchema) {}
