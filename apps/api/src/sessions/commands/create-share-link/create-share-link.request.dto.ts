import { createShareLinkSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateShareLinkRequest extends createZodDto(createShareLinkSchema) {}
