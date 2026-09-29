import { addWorkspaceMemberSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AddWorkspaceMemberRequest extends createZodDto(addWorkspaceMemberSchema) {}
