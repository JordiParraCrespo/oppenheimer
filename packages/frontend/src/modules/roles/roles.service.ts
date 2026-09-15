import type { CreateRoleDto, UpdateRoleDto } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { FindRolesParams } from './role.entity';
import type { RolesRepository } from './roles.repository';

@injectable()
export class RolesService {
  constructor(
    @inject(TOKENS.RolesRepository)
    private readonly repository: RolesRepository,
  ) {}

  findAll(params?: FindRolesParams) {
    return this.repository.findAll(params);
  }
  create(dto: CreateRoleDto) {
    return this.repository.create(dto);
  }
  update(id: string, dto: UpdateRoleDto) {
    return this.repository.update(id, dto);
  }
  remove(id: string) {
    return this.repository.remove(id);
  }
  findForUser(userId: string) {
    return this.repository.findForUser(userId);
  }
  assignToUser(userId: string, roleIds: string[]) {
    return this.repository.assignToUser(userId, roleIds);
  }
  catalog() {
    return this.repository.catalog();
  }
}
