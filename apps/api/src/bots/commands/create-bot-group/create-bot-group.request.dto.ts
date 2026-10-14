import { createBotGroupSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBotGroupRequest extends createZodDto(createBotGroupSchema) {}
