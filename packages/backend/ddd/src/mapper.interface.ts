/**
 * Maps a domain entity between the three representations that cross the
 * boundaries of a hexagon:
 *
 * - `toPersistence` — domain entity → persistence (ORM) record
 * - `toDomain`      — persistence record → domain entity
 * - `toResponse`    — domain entity → response DTO returned to clients
 */
export interface Mapper<DomainEntity, DbRecord, Response = unknown> {
  toPersistence(entity: DomainEntity): DbRecord;
  toDomain(record: DbRecord): DomainEntity;
  toResponse(entity: DomainEntity): Response;
}
