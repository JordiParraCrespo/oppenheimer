import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { CreateLeadHttpController } from './commands/create-lead/create-lead.http.controller';
import { CreateLeadService } from './commands/create-lead/create-lead.service';
import { LeadOrmEntity } from './database/lead.orm-entity';
import { LeadRepository } from './database/lead.repository';
import { LEAD_REPOSITORY } from './leads.di-tokens';
import { LeadMapper } from './leads.mapper';
import { LeadResource } from './leads.resource';
import { FindLeadByIdHttpController } from './queries/find-lead-by-id/find-lead-by-id.http.controller';
import { FindLeadByIdQueryHandler } from './queries/find-lead-by-id/find-lead-by-id.query-handler';
import { FindLeadsHttpController } from './queries/find-leads/find-leads.http.controller';
import { FindLeadsQueryHandler } from './queries/find-leads/find-leads.query-handler';

// Static routes before parameterized ones, so `POST /leads` is not shadowed.
const httpControllers = [
  FindLeadsHttpController,
  CreateLeadHttpController,
  FindLeadByIdHttpController,
];

const commandHandlers: Provider[] = [CreateLeadService];
const queryHandlers: Provider[] = [FindLeadsQueryHandler, FindLeadByIdQueryHandler];
const mappers: Provider[] = [LeadMapper];
const repositories: Provider[] = [{ provide: LEAD_REPOSITORY, useClass: LeadRepository }];

/**
 * The reference module for the authorization kernel.
 *
 * Everything authorization-related it does is three lines: register the entity,
 * contribute the resource declaration, and let the repository extend
 * `ScopedRepositoryBase`. No guard is written and no tenant filter is
 * hand-rolled — and the module cannot be misconfigured silently, because a
 * declaration naming a column the table lacks fails at boot and a scoped
 * repository queried without a scope throws.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([LeadOrmEntity]),
    AuthzKernelModule.forFeature([LeadResource]),
  ],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...mappers, ...repositories],
  exports: [LEAD_REPOSITORY],
})
export class LeadsModule {}
