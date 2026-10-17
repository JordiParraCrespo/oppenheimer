import { Module } from '@nestjs/common';
import { HOST_UPDATE } from '../hosts/hosts.di-tokens';
import { HOST_FOLDERS, SESSION_DISPATCH } from '../sessions/sessions.di-tokens';
import { CacheParkedFileAdapter } from './infrastructure/cache-parked-file.adapter';
import { InProcessLinkReplies } from './infrastructure/in-process-link-replies.adapter';
import { InProcessLinkRegistry } from './infrastructure/link-registry.adapter';
import { RelayDispatchAdapter } from './infrastructure/relay-dispatch.adapter';
import { RelayHostFoldersAdapter } from './infrastructure/relay-host-folders.adapter';
import { RelayHostUpdateAdapter } from './infrastructure/relay-host-update.adapter';
import { LINK_REGISTRY, LINK_REPLIES, PARKED_FILES } from './links.di-tokens';

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
    { provide: PARKED_FILES, useClass: CacheParkedFileAdapter },
    // One instance: the folder lister waits on it, the relay's gateway settles it.
    { provide: LINK_REPLIES, useClass: InProcessLinkReplies },
    { provide: HOST_FOLDERS, useClass: RelayHostFoldersAdapter },
    { provide: HOST_UPDATE, useClass: RelayHostUpdateAdapter },
  ],
  exports: [LINK_REGISTRY, SESSION_DISPATCH, PARKED_FILES, LINK_REPLIES, HOST_FOLDERS, HOST_UPDATE],
})
export class LinksModule {}
