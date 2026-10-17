import { botMemoryFactSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateBotMemoryFactRequest extends createZodDto(botMemoryFactSchema) {}
