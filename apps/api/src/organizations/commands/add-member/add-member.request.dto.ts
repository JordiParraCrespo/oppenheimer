import { addMemberSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AddMemberRequest extends createZodDto(addMemberSchema) {}
