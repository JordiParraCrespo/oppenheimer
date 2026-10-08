import { issueSharedAttachTicketSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class IssueSharedAttachTicketRequest extends createZodDto(issueSharedAttachTicketSchema) {}
