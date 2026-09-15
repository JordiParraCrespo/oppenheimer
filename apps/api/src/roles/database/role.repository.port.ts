import type { Paginated, RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { RoleEntity } from '../domain/role.entity';

export interface FindRolesParams {
  page: number;
  limit: number;
  search?: string;
  organizationId?: string | null;
}

/**
 * Port for persisting and querying the role aggregate. Implemented by the
 * TypeORM adapter in `role.repository.ts`.
 */
export interface RoleRepositoryPort extends RepositoryPort<RoleEntity> {
  findOneById(id: string, organizationId?: string | null): Promise<Option<RoleEntity>>;
  findOneByName(name: string, organizationId?: string | null): Promise<Option<RoleEntity>>;
  findByIds(ids: string[], organizationId?: string | null): Promise<RoleEntity[]>;
  findRoles(params: FindRolesParams): Promise<Paginated<RoleEntity>>;
}
