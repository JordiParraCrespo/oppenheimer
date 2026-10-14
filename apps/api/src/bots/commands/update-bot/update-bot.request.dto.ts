import { updateBotSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateBotRequest extends createZodDto(updateBotSchema) {}
