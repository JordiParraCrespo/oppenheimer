import { pollChatgptLoginSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PollChatgptLoginRequest extends createZodDto(pollChatgptLoginSchema) {}
