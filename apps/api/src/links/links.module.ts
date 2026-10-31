import { Module } from '@nestjs/common';
import {
  HOST_CODEX_ENVIRONMENTS,
  HOST_FOLDERS,
  SESSION_DISPATCH,
  SESSION_PORTS,
} from '../sessions/sessions.di-tokens';
import { CacheParkedFileAdapter } from './infrastructure/cache-parked-file.adapter';
import { InProcessLinkReplies } from './infrastructure/in-process-link-replies.adapter';
import { InProcessLinkRegistry } from './infrastructure/link-registry.adapter';
import { RelayDispatchAdapter } from './infrastructure/relay-dispatch.adapter';
import { RelayHostCodexEnvironmentsAdapter } from './infrastructure/relay-host-codex-environments.adapter';
import { RelayHostFoldersAdapter } from './infrastructure/relay-host-folders.adapter';
import { RelaySessionPortsAdapter } from './infrastructure/relay-session-ports.adapter';
import { LINK_REGISTRY, LINK_REPLIES, PARKED_FILES, STAGED_FILE_READER } from './links.di-tokens';

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
    // The same store: an upload is staged once, wherever it is for.
    { provide: STAGED_FILE_READER, useExisting: PARKED_FILES },
    // One instance: the folder lister waits on it, the relay's gateway settles it.
    { provide: LINK_REPLIES, useClass: InProcessLinkReplies },
    { provide: HOST_FOLDERS, useClass: RelayHostFoldersAdapter },
    { provide: SESSION_PORTS, useClass: RelaySessionPortsAdapter },
    { provide: HOST_CODEX_ENVIRONMENTS, useClass: RelayHostCodexEnvironmentsAdapter },
  ],
  exports: [
    LINK_REGISTRY,
    SESSION_DISPATCH,
    PARKED_FILES,
    STAGED_FILE_READER,
    LINK_REPLIES,
    HOST_FOLDERS,
    SESSION_PORTS,
    HOST_CODEX_ENVIRONMENTS,
  ],
})
export class LinksModule {}
