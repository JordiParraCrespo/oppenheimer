import { deleteAccountSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class DeleteOwnAccountRequest extends createZodDto(deleteAccountSchema) {}
