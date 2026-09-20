import { addCheckoutSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AddCheckoutRequest extends createZodDto(addCheckoutSchema) {}
