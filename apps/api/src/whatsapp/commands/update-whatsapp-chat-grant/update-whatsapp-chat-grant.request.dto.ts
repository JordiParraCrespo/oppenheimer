import { updateWhatsappChatGrantSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateWhatsappChatGrantRequest extends createZodDto(updateWhatsappChatGrantSchema) {}
