import { QueryBase } from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';

export class FindUsersQuery extends QueryBase {
  readonly page: number;
  readonly limit: number;
  readonly role?: Role;
  readonly search?: string;

  constructor(props: {
    page: number;
    limit: number;
    role?: Role;
    search?: string;
  }) {
    super();
    this.page = props.page;
    this.limit = props.limit;
    this.role = props.role;
    this.search = props.search;
  }
}
