import { requestWhatsappOwnerSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RequestWhatsappOwnerRequest extends createZodDto(requestWhatsappOwnerSchema) {}
