import { setBotToolDecisionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetBotToolDecisionRequest extends createZodDto(setBotToolDecisionSchema) {}
