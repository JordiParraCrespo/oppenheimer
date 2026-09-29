import { listMembersSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ListMembersRequest extends createZodDto(listMembersSchema) {}
