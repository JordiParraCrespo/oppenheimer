import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { HostFactsDto } from '@oppenheimer/shared';
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
  /**
   * The machine's facts, already validated against `hostFactsSchema` — the same
   * shape the link's `hello` and `heartbeat` carry, so pairing and the link
   * describe one machine.
   */
  facts: HostFactsDto | undefined;
  pairingTokenId: string;
}

/** Maps the host aggregate between its domain, persistence and response shapes. */
@Injectable()
export class HostMapper implements Mapper<HostEntity, HostOrmEntity, HostResponseDto> {
  /**
   * Registration payload → the props the aggregate is created from.
   *
   * The three facts worth a column of their own are pulled out — what the machine
   * calls itself, its platform and its architecture — and the whole inventory is
   * kept on `capabilities` as it arrived, because what a session wants to know
   * about a host grows and a jsonb column grows with it.
   *
   * `runnerVersion` has no column to read: the facts contract carries the
   * machine's identity and its tools, not the version of the program reporting
   * them, so it stays null until the link says otherwise.
   */
  toRegisterProps(registration: HostRegistration): RegisterHostProps {
    const facts = registration.facts;
    return {
      ownerUserId: registration.ownerUserId,
      name: registration.name,
      publicKey: registration.publicKey,
      publicKeyFingerprint: registration.publicKeyFingerprint,
      hostname: facts?.hostname ?? null,
      os: facts?.os ?? null,
      arch: facts?.arch ?? null,
      runnerVersion: null,
      capabilities: facts ? { ...facts } : null,
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
