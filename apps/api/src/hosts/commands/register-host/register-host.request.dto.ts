import { registerHostSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterHostRequest extends createZodDto(registerHostSchema) {}
