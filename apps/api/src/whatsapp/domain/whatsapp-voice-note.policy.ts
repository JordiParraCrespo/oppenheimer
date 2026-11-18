/**
 * Whether a bot heard a voice note: its transcript, or why not, in words the
 * bot can pass on ("I could not hear your voice note: …").
 */
export type WhatsappVoiceNoteHearing =
  | { heard: true; transcript: string }
  | { heard: false; reason: string };

/** How asking the host for a voice note ended, when it did not hand it over. */
export type WhatsappVoiceNoteMiss =
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string };

/** Why a voice note the host did not hand over went unheard. */
export function whatsappVoiceNoteMissReason(miss: WhatsappVoiceNoteMiss): string {
  switch (miss.kind) {
    case 'host_offline':
      return 'the host that holds the WhatsApp number is offline';
    case 'not_supported':
      return "the host's runner is too old to hand voice notes over; updating it fixes this";
    case 'timed_out':
      return 'the host did not hand the voice note over in time';
    case 'failed':
      return FAILED[miss.code] ?? `the host refused (${miss.code})`;
  }
}

const FAILED: Readonly<Record<string, string>> = {
  WA_002: 'the WhatsApp number is not connected on its host',
  WA_005: 'the host no longer has it (voice notes can be fetched for 48 hours)',
  WA_006: 'it is too long (about two minutes at most)',
  WA_007: "WhatsApp's media server would not hand it over",
};

/** "0:12": how long a voice note runs. */
function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * A voice note as a bot reads it, in a chat or as the owner's turn:
 * `[voice note, 0:12] what it says`, or why it went unheard. `seconds` is null
 * for a note from a runner that cannot hand one over.
 */
export function whatsappVoiceNoteText(
  seconds: number | null,
  hearing: WhatsappVoiceNoteHearing | null,
): string {
  const head = seconds === null ? 'voice note' : `voice note, ${duration(seconds)}`;
  if (!hearing) return `[${head}, not transcribed]`;
  if (!hearing.heard) return `[${head}, could not be transcribed: ${hearing.reason}]`;
  return hearing.transcript ? `[${head}] ${hearing.transcript}` : `[${head}, no words heard]`;
}
