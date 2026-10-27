import { findWorkspaceBotApprovalsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindWorkspaceBotApprovalsRequest extends createZodDto(
  findWorkspaceBotApprovalsSchema,
) {}
