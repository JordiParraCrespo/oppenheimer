import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { WhatsappStateMessage } from '@oppenheimer/shared/protocol';
import { WhatsappAccountOrmEntity } from './database/whatsapp-account.orm-entity';
import { WhatsappAccountEntity, type WhatsappDeviceReport } from './domain/whatsapp-account.entity';
import { WhatsappAccountResponseDto } from './dtos/whatsapp-account.response.dto';

@Injectable()
export class WhatsappAccountMapper
  implements Mapper<WhatsappAccountEntity, WhatsappAccountOrmEntity, WhatsappAccountResponseDto>
{
  toPersistence(entity: WhatsappAccountEntity): WhatsappAccountOrmEntity {
    const record = new WhatsappAccountOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.hostId = entity.hostId;
    record.label = entity.label;
    record.status = entity.status;
    record.phone = entity.phone;
    record.displayName = entity.displayName;
    record.qr = entity.qr;
    record.qrExpiresAt = entity.qrExpiresAt;
    record.statusReason = entity.statusReason;
    return record;
  }

  toDomain(record: WhatsappAccountOrmEntity): WhatsappAccountEntity {
    return WhatsappAccountEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        hostId: record.hostId,
        label: record.label,
        status: record.status,
        phone: record.phone,
        displayName: record.displayName,
        qr: record.qr,
        qrExpiresAt: record.qrExpiresAt,
        statusReason: record.statusReason,
      },
    });
  }

  /** The QR goes out only while pairing and still valid; `hostOnline` is the link's, read now. */
  toResponse(
    entity: WhatsappAccountEntity,
    hostOnline = false,
    now = new Date(),
  ): WhatsappAccountResponseDto {
    const dto = new WhatsappAccountResponseDto();
    const qrValid =
      entity.status === 'pairing' &&
      entity.qr !== null &&
      (entity.qrExpiresAt === null || entity.qrExpiresAt > now);
    dto.id = entity.id;
    dto.hostId = entity.hostId;
    dto.label = entity.label;
    dto.status = entity.status;
    dto.hostOnline = hostOnline;
    dto.phone = entity.phone;
    dto.displayName = entity.displayName;
    dto.qr = qrValid ? entity.qr : null;
    dto.qrExpiresAt = qrValid ? (entity.qrExpiresAt?.toISOString() ?? null) : null;
    dto.statusReason = entity.statusReason;
    dto.linkedAt = entity.createdAt.toISOString();
    return dto;
  }

  /** The host's `whatsapp.state`, as the aggregate takes it. */
  toReport(message: WhatsappStateMessage): WhatsappDeviceReport {
    return {
      state: message.state,
      ...(message.qr ? { qr: message.qr } : {}),
      ...(message.qrExpiresAt ? { qrExpiresAt: new Date(message.qrExpiresAt) } : {}),
      ...(message.phone ? { phone: message.phone } : {}),
      ...(message.name ? { name: message.name } : {}),
      ...(message.reason ? { reason: message.reason } : {}),
    };
  }
}
