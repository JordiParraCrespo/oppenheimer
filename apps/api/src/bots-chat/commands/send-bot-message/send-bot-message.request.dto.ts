import { sendBotMessageSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SendBotMessageRequest extends createZodDto(sendBotMessageSchema) {}
