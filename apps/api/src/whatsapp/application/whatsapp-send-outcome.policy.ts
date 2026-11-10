import { AppError } from '@oppenheimer/backend-core';
import { WhatsappErrors } from '../domain/whatsapp.errors';
import type { WhatsappSendOutcome } from './whatsapp-device.port';

/**
 * The host's answer to a send someone is waiting on (a bot's tool, a person
 * in Settings): what went, or the problem they are told, in the module's
 * own codes. The runner's `WA_002` is the device not connected and `WA_004`
 * its own budget spent.
 */
export function whatsappSentOrThrow(outcome: WhatsappSendOutcome): { id: string; sentAt: Date } {
  switch (outcome.kind) {
    case 'sent':
      return outcome;
    case 'host_offline':
      throw new AppError(WhatsappErrors.HOST_OFFLINE);
    case 'not_supported':
      throw new AppError(WhatsappErrors.HOST_UNSUPPORTED);
    case 'timed_out':
      throw new AppError(WhatsappErrors.SEND_FAILED, {
        detail: 'The host did not answer in time; the message may still have gone.',
      });
    case 'failed':
      if (outcome.code === 'WA_002') throw new AppError(WhatsappErrors.NOT_CONNECTED);
      if (outcome.code === 'WA_004') {
        throw new AppError(WhatsappErrors.SEND_LIMIT_REACHED, {
          detail: 'The host’s own send budget is spent.',
        });
      }
      throw new AppError(WhatsappErrors.SEND_FAILED, {
        detail: outcome.detail ?? outcome.code,
        extensions: { upstreamCode: outcome.code },
      });
  }
}
