import { confirmWhatsappOwnerSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ConfirmWhatsappOwnerRequest extends createZodDto(confirmWhatsappOwnerSchema) {}
