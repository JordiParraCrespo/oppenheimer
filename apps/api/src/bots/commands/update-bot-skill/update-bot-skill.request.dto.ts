import { updateBotSkillSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateBotSkillRequest extends createZodDto(updateBotSkillSchema) {}
