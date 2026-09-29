import { createWorkspaceSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateWorkspaceRequest extends createZodDto(createWorkspaceSchema) {}
