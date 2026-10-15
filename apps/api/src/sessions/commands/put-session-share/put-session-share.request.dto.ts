import { putSessionShareSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PutSessionShareRequest extends createZodDto(putSessionShareSchema) {}
