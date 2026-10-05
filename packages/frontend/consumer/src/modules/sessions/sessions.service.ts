import { inject, injectable, optional } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  AttachTicket,
  CreateSessionInput,
  PrepareSessionInput,
  SessionAttachment,
  SessionEntity,
} from './session.entity';
import { deriveSessionStartProgress, type SessionStartProgress } from './session-steps';
import type { SessionsRepository } from './sessions.repository';
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

  /**
   * One window's terminal, live: the attach socket, its reconnect ladder, a
   * fresh ticket per dial and the byte credit (`01-protocol.md`). Nothing is
   * opened until this is called, and `dispose()` closes it; the platform only
   * renders what it delivers.
   */
  openStream(id: string, window = 0): SessionStream {
    return new AttachSessionStream({
      apiBaseUrl: this.apiBaseUrl,
      issueTicket: () => this.issueAttachTicket(id, window),
    });
  }
}
