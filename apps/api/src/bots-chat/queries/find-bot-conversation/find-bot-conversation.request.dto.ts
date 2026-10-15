import { findBotConversationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindBotConversationRequest extends createZodDto(findBotConversationSchema) {}
