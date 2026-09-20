import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { HostPairingTokenOrmEntity } from './database/host-pairing-token.orm-entity';
import { HostPairingTokenEntity } from './domain/host-pairing-token.entity';
import { PairingTokenResponseDto } from './dtos/pairing-token.response.dto';

/** Maps the pairing-token aggregate between its three shapes. */
@Injectable()
export class HostPairingTokenMapper
  implements Mapper<HostPairingTokenEntity, HostPairingTokenOrmEntity, PairingTokenResponseDto>
{
  toPersistence(entity: HostPairingTokenEntity): HostPairingTokenOrmEntity {
    const record = new HostPairingTokenOrmEntity();
    record.id = entity.id;
    record.ownerUserId = entity.ownerUserId;
    record.intendedName = entity.intendedName;
    record.prefix = entity.prefix;
    record.tokenHash = entity.tokenHash;
    record.createdFromIp = entity.createdFromIp;
    record.redeemedFromIp = entity.redeemedFromIp;
    record.expiresAt = entity.expiresAt;
    record.revokedAt = entity.revokedAt;
    record.redeemedAt = entity.redeemedAt;
    record.redeemedHostId = entity.redeemedHostId;
    return record;
  }

  toDomain(record: HostPairingTokenOrmEntity): HostPairingTokenEntity {
    return HostPairingTokenEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        ownerUserId: record.ownerUserId,
        intendedName: record.intendedName,
        prefix: record.prefix,
        tokenHash: record.tokenHash,
        createdFromIp: record.createdFromIp,
        redeemedFromIp: record.redeemedFromIp,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt,
        redeemedAt: record.redeemedAt,
        redeemedHostId: record.redeemedHostId,
      },
    });
  }

  /** The digest never leaves the server; the display prefix is what identifies a row. */
  toResponse(entity: HostPairingTokenEntity): PairingTokenResponseDto {
    const dto = new PairingTokenResponseDto();
    dto.id = entity.id;
    dto.name = entity.intendedName;
    dto.prefix = entity.prefix;
    dto.createdFromIp = entity.createdFromIp;
    dto.redeemedFromIp = entity.redeemedFromIp;
    dto.expiresAt = entity.expiresAt;
    dto.revokedAt = entity.revokedAt;
    dto.redeemedAt = entity.redeemedAt;
    dto.redeemedHostId = entity.redeemedHostId;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
