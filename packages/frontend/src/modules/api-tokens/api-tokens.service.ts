import type { CreateApiTokenDto } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  ApiTokenEntity,
  CreatedApiToken,
  CurrentCredential,
  PermissionCatalog,
} from './api-token.entity';
import type { ApiTokensRepository } from './api-tokens.repository';

@injectable()
export class ApiTokensService {
  constructor(
    @inject(TOKENS.ApiTokensRepository)
    private readonly repository: ApiTokensRepository,
  ) {}

  findAll(): Promise<ApiTokenEntity[]> {
    return this.repository.findAll();
  }

  create(dto: CreateApiTokenDto): Promise<CreatedApiToken> {
    return this.repository.create(dto);
  }

  revoke(id: string): Promise<void> {
    return this.repository.revoke(id);
  }

  permissions(): Promise<PermissionCatalog> {
    return this.repository.permissions();
  }

  currentCredential(): Promise<CurrentCredential> {
    return this.repository.currentCredential();
  }
}
