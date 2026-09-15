import { createAccessGrantSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateAccessGrantRequest extends createZodDto(createAccessGrantSchema) {}
