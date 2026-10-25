import { decideBotApprovalSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class DecideBotApprovalRequest extends createZodDto(decideBotApprovalSchema) {}
