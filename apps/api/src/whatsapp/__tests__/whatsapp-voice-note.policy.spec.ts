/**
 * How a voice note reads to a bot: its length and words once heard, or why it
 * could not be heard, in words the bot can pass on. The hearing itself is the
 * `transcribe-whatsapp-voice-note` handler's spec.
 */
import { describe, expect, it } from 'vitest';
import {
  whatsappVoiceNoteMissReason,
  whatsappVoiceNoteText,
} from '../domain/whatsapp-voice-note.policy';

describe('whatsappVoiceNoteText', () => {
  // What breaks this: the bot reading "[audio]" and asking the owner to type it out.
  it('reads a heard note as its length and its words', () => {
    expect(whatsappVoiceNoteText(72, { heard: true, transcript: 'Call the bank' })).toBe(
      '[voice note, 1:12] Call the bank',
    );
    expect(whatsappVoiceNoteText(null, { heard: true, transcript: 'Hi' })).toBe('[voice note] Hi');
    expect(whatsappVoiceNoteText(3, { heard: true, transcript: '' })).toBe(
      '[voice note, 0:03, no words heard]',
    );
  });

  it('says why a note went unheard, and that an unasked one is not transcribed yet', () => {
    expect(whatsappVoiceNoteText(9, { heard: false, reason: 'the host is offline' })).toBe(
      '[voice note, 0:09, could not be transcribed: the host is offline]',
    );
    expect(whatsappVoiceNoteText(9, null)).toBe('[voice note, 0:09, not transcribed]');
  });
});

describe('whatsappVoiceNoteMissReason', () => {
  // What breaks this: a runner code reaching the owner as "WA_006" instead of a reason.
  it('names each way the host can fail to hand a note over', () => {
    expect(whatsappVoiceNoteMissReason({ kind: 'not_supported' })).toMatch(/runner is too old/);
    expect(whatsappVoiceNoteMissReason({ kind: 'failed', code: 'WA_006' })).toMatch(/too long/);
    expect(whatsappVoiceNoteMissReason({ kind: 'failed', code: 'WA_005' })).toMatch(/48 hours/);
    expect(whatsappVoiceNoteMissReason({ kind: 'failed', code: 'WA_099' })).toBe(
      'the host refused (WA_099)',
    );
  });
});
