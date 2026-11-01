import { botSkillSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBotSkillRequest extends createZodDto(botSkillSchema) {}
