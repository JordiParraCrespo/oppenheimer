import { Injectable } from '@nestjs/common';
import { SessionNamerPort } from './session-namer.port';

/**
 * The default: nothing is named, and every session keeps its minted slug.
 *
 * This is a supported configuration rather than a missing one. A slug reads fine on
 * its own ("bold-otter-3f9a7k"), naming costs a call to somebody's inference API
 * with the person's own prompt in it, and a deployment that would rather not make
 * that call simply does not configure one.
 */
@Injectable()
export class NoopSessionNamerAdapter extends SessionNamerPort {
  isConfigured(): boolean {
    return false;
  }

  async nameFor(): Promise<string | null> {
    return null;
  }
}
