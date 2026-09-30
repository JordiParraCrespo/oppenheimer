import { Module } from '@nestjs/common';
import { SESSION_DISPATCH } from '../sessions/sessions.di-tokens';
import { CacheParkedImageAdapter } from './infrastructure/cache-parked-image.adapter';
import { InProcessLinkRegistry } from './infrastructure/link-registry.adapter';
import { RelayDispatchAdapter } from './infrastructure/relay-dispatch.adapter';
import { LINK_REGISTRY, PARKED_IMAGES } from './links.di-tokens';

/**
 * Links: which host holds a live runner link, and the dispatcher that sends a
 * session's work down it. A module of its own so dependencies run one way:
 * `sessions/` imports it to dispatch, `relay/` to register the sockets it accepts,
 * and it imports no module and owns no table. One module that both dispatched and
 * recorded events would need `sessions/` and `relay/` to import each other.
 */
@Module({
  providers: [
    // A factory, so the registry's clock parameter is not mistaken for a dependency.
    { provide: LINK_REGISTRY, useFactory: () => new InProcessLinkRegistry() },
    { provide: SESSION_DISPATCH, useClass: RelayDispatchAdapter },
    { provide: PARKED_IMAGES, useClass: CacheParkedImageAdapter },
  ],
  exports: [LINK_REGISTRY, SESSION_DISPATCH, PARKED_IMAGES],
})
export class LinksModule {}
