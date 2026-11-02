import { Injectable } from '@nestjs/common';
import { type MailPlan, mailPlanSchema } from '@oppenheimer/shared';
import { MailSendOrmEntity } from './database/mail-send.orm-entity';
import { MailSendEntity } from './domain/mail-send.entity';
import { ScheduledMailResponseDto } from './dtos/scheduled-mail.response.dto';

@Injectable()
export class MailSendMapper {
  toPersistence(entity: MailSendEntity): MailSendOrmEntity {
    const record = new MailSendOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.connectionId = entity.connectionId;
    record.botId = entity.botId;
    record.approvalId = entity.approvalId;
    record.kind = entity.kind;
    record.accountEmail = entity.accountEmail;
    record.recipients = entity.recipients;
    record.subject = entity.subject;
    record.status = entity.status;
    record.gmailMessageId = entity.gmailMessageId;
    record.gmailThreadId = entity.gmailThreadId;
    record.sentAt = entity.sentAt;
    record.scheduledFor = entity.scheduledFor;
    record.plan = entity.plan;
    return record;
  }

  /** A scheduled send as Settings lists it; only one still waiting has a time. */
  toScheduledResponse(entity: MailSendEntity): ScheduledMailResponseDto {
    const dto = new ScheduledMailResponseDto();
    dto.id = entity.id;
    dto.accountEmail = entity.accountEmail;
    dto.recipients = entity.recipients;
    dto.subject = entity.subject;
    dto.scheduledFor = (entity.scheduledFor ?? entity.createdAt).toISOString();
    dto.botId = entity.botId;
    return dto;
  }

  toDomain(record: MailSendOrmEntity): MailSendEntity {
    return MailSendEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        connectionId: record.connectionId,
        botId: record.botId,
        approvalId: record.approvalId,
        kind: record.kind,
        accountEmail: record.accountEmail,
        recipients: record.recipients ?? [],
        subject: record.subject,
        status: record.status,
        gmailMessageId: record.gmailMessageId,
        gmailThreadId: record.gmailThreadId,
        sentAt: record.sentAt,
        scheduledFor: record.scheduledFor,
        plan: planOf(record.plan),
      },
    });
  }
}

/** A stored plan, narrowed once: one that no longer reads as a plan cannot be sent. */
function planOf(raw: unknown): MailPlan | null {
  if (raw === null || raw === undefined) return null;
  const parsed = mailPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
