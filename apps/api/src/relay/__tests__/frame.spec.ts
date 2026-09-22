import { describe, expect, it } from 'vitest';
import { decodeFrame, encodeFrame, FRAME_HEADER_BYTES } from '../infrastructure/frame.util';

/**
 * The binary frame is the one part of the wire the Zod schemas do not describe,
 * so its layout is pinned here: four bytes, big-endian, then the PTY bytes.
 */
describe('runner link frames', () => {
  it('prefixes the bytes with the attachment id, big-endian', () => {
    const frame = encodeFrame(0x01020304, Buffer.from('hi'));
    expect([...frame.subarray(0, FRAME_HEADER_BYTES)]).toEqual([1, 2, 3, 4]);
    expect(frame.subarray(FRAME_HEADER_BYTES).toString()).toBe('hi');
  });

  it('round-trips the largest id and an empty payload', () => {
    const decoded = decodeFrame(encodeFrame(0xffffffff, new Uint8Array()));
    expect(decoded).toEqual({ attachmentId: 0xffffffff, bytes: Buffer.alloc(0) });
  });

  it('drops a frame too short to carry a header', () => {
    expect(decodeFrame(Buffer.from([0, 0, 1]))).toBeNull();
  });

  it('refuses an id the header cannot hold', () => {
    expect(() => encodeFrame(0x1_0000_0000, Buffer.alloc(0))).toThrow(RangeError);
    expect(() => encodeFrame(-1, Buffer.alloc(0))).toThrow(RangeError);
  });
});
