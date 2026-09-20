import { issueAttachTicketSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class IssueAttachTicketRequest extends createZodDto(issueAttachTicketSchema) {}
