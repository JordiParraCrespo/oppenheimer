import { setSessionSharePeopleSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetSessionSharePeopleRequest extends createZodDto(setSessionSharePeopleSchema) {}
