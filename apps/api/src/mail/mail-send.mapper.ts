import { Injectable } from '@nestjs/common';
import { MailSendOrmEntity } from './database/mail-send.orm-entity';
import { MailSendEntity } from './domain/mail-send.entity';

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
    return record;
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
      },
    });
  }
}
