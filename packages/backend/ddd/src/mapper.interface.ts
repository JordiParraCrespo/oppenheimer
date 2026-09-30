/** Maps a domain entity between the three representations that cross the hexagon's boundaries. */
export interface Mapper<DomainEntity, DbRecord, Response = unknown> {
  toPersistence(entity: DomainEntity): DbRecord;
  toDomain(record: DbRecord): DomainEntity;
  toResponse(entity: DomainEntity): Response;
}
