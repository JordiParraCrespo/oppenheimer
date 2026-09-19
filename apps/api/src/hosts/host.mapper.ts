import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { HostOrmEntity } from './database/host.orm-entity';
import { HostEntity, type RegisterHostProps } from './domain/host.entity';
import { HostResponseDto } from './dtos/host.response.dto';

/** What a runner sends when it registers, before anything has been read out of it. */
export interface HostRegistration {
  ownerUserId: string;
  /** The name the token carried, or the one the runner detected. */
  name: string;
  publicKey: string;
  publicKeyFingerprint: string;
  facts: unknown;
  pairingTokenId: string;
}

/** Maps the host aggregate between its domain, persistence and response shapes. */
@Injectable()
export class HostMapper implements Mapper<HostEntity, HostOrmEntity, HostResponseDto> {
  /**
   * Registration payload → the props the aggregate is created from.
   *
   * The runner sends one inventory of the machine and this pulls the four
   * columns worth querying out of it — the platform family, the architecture,
   * the machine's own name and the runner's version — while keeping the whole
   * thing on `capabilities`, because what a session needs to know about a host
   * grows and a jsonb column grows with it.
   *
   * Everything is read defensively. The inventory is validated by the request
   * schema before it reaches here, but it is written by a program on someone
   * else's laptop and a field that is missing or of the wrong type is a column
   * left null, never a failed registration.
   */
  toRegisterProps(registration: HostRegistration): RegisterHostProps {
    const facts = asRecord(registration.facts);
    return {
      ownerUserId: registration.ownerUserId,
      name: registration.name,
      publicKey: registration.publicKey,
      publicKeyFingerprint: registration.publicKeyFingerprint,
      hostname: text(facts.hostname),
      // The runner reports the host family it installs a service for
      // (`macos`, `debian`, `ubuntu`, `linux`); the release of that family is
      // kept with the rest of the inventory.
      os: text(facts.platform),
      arch: text(facts.arch),
      runnerVersion: text(facts.runnerVersion),
      capabilities: Object.keys(facts).length > 0 ? facts : null,
      pairingTokenId: registration.pairingTokenId,
    };
  }

  toPersistence(entity: HostEntity): HostOrmEntity {
    const record = new HostOrmEntity();
    record.id = entity.id;
    record.ownerUserId = entity.ownerUserId;
    record.name = entity.name;
    record.hostname = entity.hostname;
    record.os = entity.os;
    record.arch = entity.arch;
    record.runnerVersion = entity.runnerVersion;
    record.capabilities = entity.capabilities;
    record.publicKey = entity.publicKey;
    record.publicKeyFingerprint = entity.publicKeyFingerprint;
    record.previousPublicKey = entity.previousPublicKey;
    record.previousPublicKeyFingerprint = entity.previousPublicKeyFingerprint;
    record.previousPublicKeyExpiresAt = entity.previousPublicKeyExpiresAt;
    record.lastSeenAt = entity.lastSeenAt;
    record.unpairedAt = entity.unpairedAt;
    return record;
  }

  toDomain(record: HostOrmEntity): HostEntity {
    return HostEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        ownerUserId: record.ownerUserId,
        name: record.name,
        hostname: record.hostname,
        os: record.os,
        arch: record.arch,
        runnerVersion: record.runnerVersion,
        capabilities: record.capabilities,
        publicKey: record.publicKey,
        publicKeyFingerprint: record.publicKeyFingerprint,
        previousPublicKey: record.previousPublicKey,
        previousPublicKeyFingerprint: record.previousPublicKeyFingerprint,
        previousPublicKeyExpiresAt: record.previousPublicKeyExpiresAt,
        lastSeenAt: record.lastSeenAt,
        unpairedAt: record.unpairedAt,
      },
    });
  }

  /**
   * Domain → response.
   *
   * `online` is not a column and is never derived here: it is
   * `lastSeenAt > now() − 2 × heartbeat`, computed by the read query in the
   * database so the list cannot disagree with itself between rows. It arrives as
   * an argument for that reason.
   *
   * The public key itself stays on the server. What identifies a machine to a
   * person is its fingerprint, and that is what the console shows.
   */
  toResponse(entity: HostEntity, online = false): HostResponseDto {
    const dto = new HostResponseDto();
    dto.id = entity.id;
    dto.ownerUserId = entity.ownerUserId;
    dto.name = entity.name;
    dto.hostname = entity.hostname;
    dto.os = entity.os;
    dto.arch = entity.arch;
    dto.runnerVersion = entity.runnerVersion;
    dto.capabilities = entity.capabilities;
    dto.publicKeyFingerprint = entity.publicKeyFingerprint;
    dto.online = online;
    dto.lastSeenAt = entity.lastSeenAt;
    dto.unpairedAt = entity.unpairedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
