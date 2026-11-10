import { updateWhatsappAccountSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateWhatsappAccountRequest extends createZodDto(updateWhatsappAccountSchema) {}
