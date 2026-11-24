/** Media a linked number received that its host hands over when asked (`whatsapp.media.get`). */
export type WhatsappMediaKind = 'voice_note' | 'image';

/** How asking the host for a voice note or an image ended, when it did not hand it over. */
export type WhatsappMediaMiss =
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string };

/** The words that differ between the kinds, in the reasons below. */
const NAMED: Readonly<
  Record<WhatsappMediaKind, { one: string; many: string; tooLarge: string }>
> = {
  voice_note: {
    one: 'voice note',
    many: 'voice notes',
    tooLarge: 'it is too long (about two minutes at most)',
  },
  image: { one: 'image', many: 'images', tooLarge: 'it is too large to hand over' },
};

/**
 * Why media the host did not hand over went unheard or unseen, in words a
 * bot can pass on ("I could not hear your voice note: …"). A code the host
 * sent that is not one of the link's is named as it came.
 */
export function whatsappMediaMissReason(kind: WhatsappMediaKind, miss: WhatsappMediaMiss): string {
  const named = NAMED[kind];
  switch (miss.kind) {
    case 'host_offline':
      return 'the host that holds the WhatsApp number is offline';
    case 'not_supported':
      return `the host's runner is too old to hand ${named.many} over; updating it fixes this`;
    case 'timed_out':
      return `the host did not hand the ${named.one} over in time`;
    case 'failed':
      switch (miss.code) {
        case 'WA_002':
          return 'the WhatsApp number is not connected on its host';
        case 'WA_005':
          return `the host no longer has it (${named.many} can be fetched for 48 hours)`;
        case 'WA_006':
          return named.tooLarge;
        case 'WA_007':
          return "WhatsApp's media server would not hand it over";
        default:
          return `the host refused (${miss.code})`;
      }
  }
}
