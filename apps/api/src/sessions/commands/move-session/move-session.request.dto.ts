import { moveSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class MoveSessionRequest extends createZodDto(moveSessionSchema) {}
