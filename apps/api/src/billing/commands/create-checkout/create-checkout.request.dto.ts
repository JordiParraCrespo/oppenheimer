import { createCheckoutSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCheckoutRequest extends createZodDto(createCheckoutSchema) {}
