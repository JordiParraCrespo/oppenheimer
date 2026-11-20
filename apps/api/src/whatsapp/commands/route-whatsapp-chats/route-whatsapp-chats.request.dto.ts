import { routeWhatsappChatsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RouteWhatsappChatsRequest extends createZodDto(routeWhatsappChatsSchema) {}
