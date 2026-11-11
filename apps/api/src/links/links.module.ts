import { Module } from '@nestjs/common';
import {
  HOST_BROWSER,
  HOST_CODEX_ENVIRONMENTS,
  HOST_COMPUTER,
  HOST_EXEC,
  HOST_FOLDERS,
  SESSION_DISPATCH,
  SESSION_PORTS,
  SESSION_SHARED_FILES,
  SESSION_TERMINAL,
  SESSION_TRANSCRIPT,
} from '../sessions/sessions.di-tokens';
import { TELEGRAM_DEVICE } from '../telegram/telegram.di-tokens';
import { WHATSAPP_DEVICE } from '../whatsapp/whatsapp.di-tokens';
import { CacheParkedFileAdapter } from './infrastructure/cache-parked-file.adapter';
import { InProcessLinkReplies } from './infrastructure/in-process-link-replies.adapter';
import { InProcessLinkRegistry } from './infrastructure/link-registry.adapter';
import { RelayDispatchAdapter } from './infrastructure/relay-dispatch.adapter';
import { RelayHostBrowserAdapter } from './infrastructure/relay-host-browser.adapter';
import { RelayHostCodexEnvironmentsAdapter } from './infrastructure/relay-host-codex-environments.adapter';
import { RelayHostComputerAdapter } from './infrastructure/relay-host-computer.adapter';
import { RelayHostExecAdapter } from './infrastructure/relay-host-exec.adapter';
import { RelayHostFoldersAdapter } from './infrastructure/relay-host-folders.adapter';
import { RelaySessionPortsAdapter } from './infrastructure/relay-session-ports.adapter';
import { RelaySessionSharedFilesAdapter } from './infrastructure/relay-session-shared-files.adapter';
import { RelaySessionTerminalAdapter } from './infrastructure/relay-session-terminal.adapter';
import { RelaySessionTranscriptAdapter } from './infrastructure/relay-session-transcript.adapter';
import { RelayTelegramDeviceAdapter } from './infrastructure/relay-telegram-device.adapter';
import { RelayWhatsappDeviceAdapter } from './infrastructure/relay-whatsapp-device.adapter';
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
    { provide: HOST_EXEC, useClass: RelayHostExecAdapter },
    { provide: HOST_COMPUTER, useClass: RelayHostComputerAdapter },
    { provide: HOST_BROWSER, useClass: RelayHostBrowserAdapter },
    { provide: SESSION_PORTS, useClass: RelaySessionPortsAdapter },
    { provide: SESSION_SHARED_FILES, useClass: RelaySessionSharedFilesAdapter },
    { provide: SESSION_TRANSCRIPT, useClass: RelaySessionTranscriptAdapter },
    { provide: SESSION_TERMINAL, useClass: RelaySessionTerminalAdapter },
    { provide: HOST_CODEX_ENVIRONMENTS, useClass: RelayHostCodexEnvironmentsAdapter },
    { provide: WHATSAPP_DEVICE, useClass: RelayWhatsappDeviceAdapter },
    { provide: TELEGRAM_DEVICE, useClass: RelayTelegramDeviceAdapter },
  ],
  exports: [
    LINK_REGISTRY,
    SESSION_DISPATCH,
    PARKED_FILES,
    STAGED_FILE_READER,
    LINK_REPLIES,
    HOST_FOLDERS,
    HOST_EXEC,
    HOST_COMPUTER,
    HOST_BROWSER,
    SESSION_PORTS,
    SESSION_SHARED_FILES,
    SESSION_TRANSCRIPT,
    SESSION_TERMINAL,
    HOST_CODEX_ENVIRONMENTS,
    WHATSAPP_DEVICE,
    TELEGRAM_DEVICE,
  ],
})
export class LinksModule {}
