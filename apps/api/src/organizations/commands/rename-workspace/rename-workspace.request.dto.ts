import { updateWorkspaceSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

// The class name is the schema name in the OpenAPI document, and so the type
// name in the generated client: it keeps the name it was published under.
export class UpdateWorkspaceRequest extends createZodDto(updateWorkspaceSchema) {}
