import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

export const OrganizationsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.OrganizationsRepository).to(OrganizationsRepository).inSingletonScope();
  bind(TOKENS.OrganizationsService).to(OrganizationsService).inSingletonScope();
});
