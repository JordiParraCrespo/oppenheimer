import type { WhatsappMediaKind } from '@oppenheimer/shared/protocol';

/**
 * Whether a message is a voice note with no caption: one whose words are what
 * it says, to be heard, rather than a caption to read. The one definition the
 * owner's wake, the hearing and a bot's reads of a chat share.
 */
export function isWhatsappVoiceNote(message: {
  media: WhatsappMediaKind | null;
  text: string;
}): boolean {
  return message.media === 'audio' && !message.text.trim();
}

/**
 * Whether a bot heard a voice note: its transcript, or why not, in words the
 * bot can pass on ("I could not hear your voice note: …").
 */
export type WhatsappVoiceNoteHearing =
  | { heard: true; transcript: string }
  | { heard: false; reason: string };

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
