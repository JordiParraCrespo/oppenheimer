import { deleteAccountSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class DeleteAccountRequest extends createZodDto(deleteAccountSchema) {}
