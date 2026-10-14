import { updateBotGroupSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateBotGroupRequest extends createZodDto(updateBotGroupSchema) {}
