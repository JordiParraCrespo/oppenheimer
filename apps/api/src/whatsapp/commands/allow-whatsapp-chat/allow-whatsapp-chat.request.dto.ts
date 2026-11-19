import { allowWhatsappChatSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AllowWhatsappChatRequest extends createZodDto(allowWhatsappChatSchema) {}
