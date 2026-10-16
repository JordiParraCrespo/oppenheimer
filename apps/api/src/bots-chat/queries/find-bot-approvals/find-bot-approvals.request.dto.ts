import { findBotApprovalsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindBotApprovalsRequest extends createZodDto(findBotApprovalsSchema) {}
