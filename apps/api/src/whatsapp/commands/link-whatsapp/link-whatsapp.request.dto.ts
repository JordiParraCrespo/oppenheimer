import { linkWhatsappSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class LinkWhatsappRequest extends createZodDto(linkWhatsappSchema) {}
