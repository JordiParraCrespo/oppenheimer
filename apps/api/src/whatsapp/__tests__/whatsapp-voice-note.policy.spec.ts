/**
 * How a voice note reads to a bot: its length and words once heard, or why it
 * could not be heard, in words the bot can pass on. The hearing itself is the
 * `transcribe-whatsapp-voice-note` handler's spec.
 */

import { describe, expect, it } from 'vitest';
import { whatsappMediaMissReason } from '../domain/whatsapp-media.policy';
import { whatsappVoiceNoteText } from '../domain/whatsapp-voice-note.policy';

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

describe('whatsappMediaMissReason', () => {
  // What breaks this: a runner code reaching the owner as "WA_006" instead of a
  // reason, or an image's miss worded as a voice note's.
  it('names each way the host can fail to hand a note or an image over, in the kind’s words', () => {
    expect(whatsappMediaMissReason('voice_note', { kind: 'not_supported' })).toMatch(
      /too old to hand voice notes over/,
    );
    expect(whatsappMediaMissReason('voice_note', { kind: 'failed', code: 'WA_006' })).toMatch(
      /too long/,
    );
    expect(whatsappMediaMissReason('voice_note', { kind: 'failed', code: 'WA_005' })).toMatch(
      /voice notes can be fetched for 48 hours/,
    );
    expect(whatsappMediaMissReason('image', { kind: 'not_supported' })).toMatch(
      /too old to hand images over/,
    );
    expect(whatsappMediaMissReason('image', { kind: 'failed', code: 'WA_006' })).toBe(
      'it is too large to hand over',
    );
    expect(whatsappMediaMissReason('image', { kind: 'timed_out' })).toBe(
      'the host did not hand the image over in time',
    );
    expect(whatsappMediaMissReason('image', { kind: 'failed', code: 'WA_099' })).toBe(
      'the host refused (WA_099)',
    );
  });
});
