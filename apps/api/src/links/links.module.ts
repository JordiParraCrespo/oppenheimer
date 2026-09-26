import { Module } from '@nestjs/common';
import { SESSION_DISPATCH } from '../sessions/sessions.di-tokens';
import { CacheParkedImageAdapter } from './infrastructure/cache-parked-image.adapter';
import { InProcessLinkRegistry } from './infrastructure/link-registry.adapter';
import { RelayDispatchAdapter } from './infrastructure/relay-dispatch.adapter';
import { LINK_REGISTRY, PARKED_IMAGES } from './links.di-tokens';

/**
 * Links: which host holds a live runner link, and the dispatcher that sends a
 * session's work down it.
 *
 * It is its own module rather than part of `relay/` so the dependency runs one
 * way: `sessions/` imports this to dispatch, `relay/` imports this to register
 * the sockets it accepts, and this module imports nothing — no other module,
 * no table — and knows the two only through their ports and tokens. The
 * alternative, one module that both dispatches and records events, would need
 * `sessions/` and `relay/` to import each other.
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
