import { inviteMemberSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class InviteMemberRequest extends createZodDto(inviteMemberSchema) {}
