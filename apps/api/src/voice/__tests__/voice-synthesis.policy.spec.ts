import { oggOpusSeconds } from '../domain/voice-synthesis.policy';
import { oggOpus, oggPage } from './ogg-opus.spec-support';

/**
 * How long spoken audio runs, read from its Ogg pages: the duration a
 * WhatsApp voice note shows before it is played, and the gate that keeps a
 * provider's MP3, WAV or error page from reaching a phone as a broken note.
 */

describe('oggOpusSeconds', () => {
  it('reads the length from the last granule, less the encoder’s lead-in, rounded up', () => {
    expect(oggOpusSeconds(oggOpus(312 + 48_000 * 3))).toBe(3);
    expect(oggOpusSeconds(oggOpus(312 + 48_000 * 3 + 1))).toBe(4);
  });

  it('refuses audio that is not whole Ogg/Opus', () => {
    expect(oggOpusSeconds(Buffer.from('ID3\x04mp3 frames'))).toBeNull();
    expect(
      oggOpusSeconds(
        Buffer.concat([oggPage(0, Buffer.from('vorbis..')), oggPage(96_000, Buffer.from('x'))]),
      ),
    ).toBeNull();
    // Cut off mid-page, as a dropped download would be.
    expect(oggOpusSeconds(oggOpus(96_000).subarray(0, 60))).toBeNull();
    // No sound past the lead-in.
    expect(oggOpusSeconds(oggOpus(312))).toBeNull();
    expect(oggOpusSeconds(Buffer.alloc(0))).toBeNull();
  });
});
