import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { AttachDesktopConnection } from './desktop/desktop-connection';
import type { HostsRepository } from './hosts.repository';

@injectable()
export class HostsService {
  constructor(
    @inject(TOKENS.HostsRepository)
    private readonly repository: HostsRepository,
    @inject(TOKENS.ApiBaseUrl)
    private readonly apiBaseUrl: string = '',
  ) {}

  /**
   * One dial to the host's own desktop: the screen-sharing server its owner
   * shared with `runner desktop on`, signed in to by its runner, as a channel
   * a VNC viewer attaches to. Loaded on demand: a reader who never opens a
   * desktop never downloads it.
   */
  async openDesktop(id: string): Promise<AttachDesktopConnection> {
    const { AttachDesktopConnection } = await import('./desktop/desktop-connection');
    return new AttachDesktopConnection({
      apiBaseUrl: this.apiBaseUrl,
      issueTicket: () => this.repository.issueDesktopTicket(id),
    });
  }
}
