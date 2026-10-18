import type { PutSessionShareDto } from '@oppenheimer/shared/schemas/session-share';
import { inject, injectable, optional } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  AttachTicket,
  CreateSessionInput,
  PrepareSessionInput,
  SessionAttachment,
  SessionEntity,
  SessionShare,
  SharedSession,
} from './session.entity';
import { deriveSessionStartProgress, type SessionStartProgress } from './session-steps';
import type { SessionsRepository } from './sessions.repository';
import { DesktopSessionStream, desktopBridge } from './stream/desktop-stream';
import { AttachSessionStream, type SessionStream } from './stream/session-stream';

@injectable()
export class SessionsService {
  constructor(
    @inject(TOKENS.SessionsRepository)
    private readonly repository: SessionsRepository,
    @inject(TOKENS.ApiBaseUrl)
    @optional()
    private readonly apiBaseUrl: string = '',
  ) {}

  findAll(): Promise<SessionEntity[]> {
    return this.repository.findAll();
  }

  findById(id: string): Promise<SessionEntity> {
    return this.repository.findById(id);
  }

  /**
   * How a session's start is going, as the host reported it. `failed` is the
   * row's lifecycle, which can run a read ahead of the log's reason.
   */
  async startProgress(id: string, { failed }: { failed: boolean }): Promise<SessionStartProgress> {
    return deriveSessionStartProgress(await this.repository.findStartLog(id), { failed });
  }

  create(input: CreateSessionInput, idempotencyKey: string): Promise<SessionEntity> {
    return this.repository.create(input, idempotencyKey);
  }

  prepare(input: PrepareSessionInput): Promise<string[]> {
    return this.repository.prepare(input);
  }

  rename(id: string, name: string): Promise<SessionEntity> {
    return this.repository.rename(id, name);
  }

  move(id: string, projectId: string): Promise<SessionEntity> {
    return this.repository.move(id, projectId);
  }

  restart(id: string): Promise<SessionEntity> {
    return this.repository.restart(id);
  }

  close(id: string, acceptUnpushedWork = false): Promise<SessionEntity> {
    return this.repository.close(id, acceptUnpushedWork);
  }

  issueAttachTicket(id: string, window = 0): Promise<AttachTicket> {
    return this.repository.issueAttachTicket(id, window);
  }

  uploadAttachment(file: Blob): Promise<SessionAttachment> {
    return this.repository.uploadAttachment(file);
  }

  pasteFile(id: string, file: Blob, window = 0): Promise<void> {
    return this.repository.pasteFile(id, file, window);
  }

  findShare(id: string): Promise<SessionShare | null> {
    return this.repository.findShare(id);
  }

  putShare(id: string, input: PutSessionShareDto): Promise<SessionShare> {
    return this.repository.putShare(id, input);
  }

  setSharePeople(id: string, people: string[]): Promise<SessionShare> {
    return this.repository.setSharePeople(id, people);
  }

  stopShare(id: string): Promise<void> {
    return this.repository.stopShare(id);
  }

  findSharedSession(slug: string): Promise<SharedSession> {
    return this.repository.findSharedSession(slug);
  }

  /**
   * A shared terminal, live: the same socket and ladder as a member's, with
   * each ticket minted through the share. A `read` share's stream is the same
   * stream; the relay and the host are what keep its keystrokes out.
   */
  openSharedStream(slug: string): SessionStream {
    return new AttachSessionStream({
      apiBaseUrl: this.apiBaseUrl,
      issueTicket: () => this.repository.issueSharedAttachTicket(slug),
    });
  }

  /**
   * One window's terminal, live: the attach socket, its reconnect ladder, a
   * fresh ticket per dial and the byte credit (`01-protocol.md`). Nothing is
   * opened until this is called, and `dispose()` closes it; the platform only
   * renders what it delivers. `direct` says whether to take a direct path when
   * the relay offers one (22); it is asked at each offer.
   */
  openStream(id: string, window = 0, options: { direct?: () => boolean } = {}): SessionStream {
    const remote = () =>
      new AttachSessionStream({
        apiBaseUrl: this.apiBaseUrl,
        issueTicket: () => this.issueAttachTicket(id, window),
        direct: options.direct,
      });
    // Inside the desktop app, a session on this machine skips the network (27).
    const bridge = desktopBridge();
    return bridge ? new DesktopSessionStream(bridge, id, window, remote) : remote();
  }
}
