import { createBotSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBotRequest extends createZodDto(createBotSchema) {}
