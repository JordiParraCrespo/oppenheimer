export interface Mapper<Entity, ServiceModel, ResponseDto> {
  toRepository(data: Partial<Entity>): Entity;
  toService(entity: Entity): ServiceModel;
  toController(model: ServiceModel): ResponseDto;
}
