import { listAutomationsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindAutomationsRequest extends createZodDto(listAutomationsQuerySchema) {}
