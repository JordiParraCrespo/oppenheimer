import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { ResourceDefinition } from './registry/resource-definition';
import { ResourceRegistry } from './registry/resource-registry';

/** Provider token collecting every declaration passed to `forFeature`. */
const RESOURCE_DEFINITIONS = Symbol('AUTHZ_RESOURCE_DEFINITIONS');

/**
 * The authorization kernel.
 *
 * `forRoot()` is imported once and provides the registry globally, so guards in
 * any feature module can resolve it without circular imports — the same reason
 * `RolesModule` is global.
 *
 * `forFeature([...])` is imported by each feature module to contribute its
 * resource declarations. Registration happens when the module is instantiated,
 * so a module that is never imported contributes nothing — which keeps the
 * catalog an accurate description of what the running application exposes.
 */
@Global()
@Module({})
export class AuthzModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthzModule,
      providers: [ResourceRegistry],
      exports: [ResourceRegistry],
    };
  }

  static forFeature(definitions: readonly ResourceDefinition[]): DynamicModule {
    return {
      module: AuthzModule,
      providers: [
        { provide: RESOURCE_DEFINITIONS, useValue: definitions },
        {
          provide: `${String(RESOURCE_DEFINITIONS)}_REGISTRATION`,
          inject: [ResourceRegistry, RESOURCE_DEFINITIONS],
          useFactory: (registry: ResourceRegistry, resources: readonly ResourceDefinition[]) => {
            registry.registerAll(resources);
            return true;
          },
        },
      ],
    };
  }
}
