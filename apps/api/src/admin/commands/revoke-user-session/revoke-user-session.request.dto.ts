import { revokeSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

// Keeps its published schema name, the client's type name (apps/api/AGENTS.md).
export class RevokeSessionRequest extends createZodDto(revokeSessionSchema) {}
