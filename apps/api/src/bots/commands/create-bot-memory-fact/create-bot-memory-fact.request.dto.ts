import { botMemoryFactSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBotMemoryFactRequest extends createZodDto(botMemoryFactSchema) {}
