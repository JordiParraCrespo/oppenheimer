import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it } from 'vitest';
import type { ProjectUsagePort } from '../application/project-usage.port';
import { ProjectUsageRegistry } from '../application/project-usage.registry';
import { ProjectsModule } from '../projects.module';

/**
 * A token the contributing module keeps to itself. If the contribution were built
 * anywhere but in that module's injector, this would not resolve — which is the
 * property the whole arrangement exists for: answering "is this project still in
 * use" must not force a module to publish its repository ports application-wide.
 */
const FEATURE_ONLY = Symbol('FEATURE_ONLY');

@Injectable()
class FeatureProjectUsage implements ProjectUsagePort {
  constructor(@Inject(FEATURE_ONLY) private readonly store: { busyProjectId: string }) {}

  async hasUnresolvedSessions(_scope: AccessScope, projectId: string): Promise<boolean> {
    return projectId === this.store.busyProjectId;
  }
}

/**
 * Stands in for `ProjectsModule`, which cannot boot here: it configures the ORM.
 * What matters is that the registry is a provider this module exports, which is
 * exactly how the real module publishes it.
 */
@Module({ providers: [ProjectUsageRegistry], exports: [ProjectUsageRegistry] })
class ProjectsStubModule {}

@Module({
  imports: [ProjectsStubModule],
  providers: [
    { provide: FEATURE_ONLY, useValue: { busyProjectId: 'project-busy' } },
    ...ProjectsModule.contributeUsage([FeatureProjectUsage]),
  ],
})
class FeatureModule {}

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
} as AccessScope;

describe('ProjectsModule.contributeUsage', () => {
  it('registers the contribution at boot, with nothing injecting it', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FeatureModule] }).compile();
    await moduleRef.init();

    const registry = moduleRef.get(ProjectUsageRegistry, { strict: false });

    // Nothing asked for the contribution provider; constructing it *is* the
    // registration, so a module that is never imported contributes nothing.
    expect(registry.canAnswer()).toBe(true);
  });

  it('builds the implementation in the contributing module’s injector', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FeatureModule] }).compile();
    await moduleRef.init();

    const registry = moduleRef.get(ProjectUsageRegistry, { strict: false });

    // Answered from a provider only `FeatureModule` declares.
    await expect(registry.isInUse(SCOPE, 'project-busy')).resolves.toBe(true);
    await expect(registry.isInUse(SCOPE, 'project-quiet')).resolves.toBe(false);
  });

  it('cannot answer at all when nothing was contributed', async () => {
    // The fail-closed case, and the reason archiving refuses rather than assuming.
    const moduleRef = await Test.createTestingModule({ imports: [ProjectsStubModule] }).compile();
    await moduleRef.init();

    expect(moduleRef.get(ProjectUsageRegistry, { strict: false }).canAnswer()).toBe(false);
  });
});
