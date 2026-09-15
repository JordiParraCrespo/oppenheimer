import { createPortalSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreatePortalRequest extends createZodDto(createPortalSchema) {}
