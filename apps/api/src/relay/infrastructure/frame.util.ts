/**
 * The runner link's binary frame: a 4-byte big-endian attachment id, then the
 * PTY bytes (`product/versions/mvp/01-protocol.md`, "Framing"). No JSON, no
 * base64, and nothing else in the header — session ids and window indices never
 * appear in a binary frame.
 */
export const FRAME_HEADER_BYTES = 4;

export const MAX_ATTACHMENT_ID = 0xffffffff;

export function encodeFrame(attachmentId: number, bytes: Uint8Array): Buffer {
  if (!Number.isInteger(attachmentId) || attachmentId < 0 || attachmentId > MAX_ATTACHMENT_ID) {
    throw new RangeError(`attachment id out of range: ${attachmentId}`);
  }
  const frame = Buffer.allocUnsafe(FRAME_HEADER_BYTES + bytes.byteLength);
  frame.writeUInt32BE(attachmentId, 0);
  frame.set(bytes, FRAME_HEADER_BYTES);
  return frame;
}

export interface DecodedFrame {
  attachmentId: number;
  bytes: Buffer;
}

/** `null` for a frame too short to carry a header: dropped, never guessed at. */
export function decodeFrame(frame: Buffer): DecodedFrame | null {
  if (frame.byteLength < FRAME_HEADER_BYTES) return null;
  return {
    attachmentId: frame.readUInt32BE(0),
    bytes: frame.subarray(FRAME_HEADER_BYTES),
  };
}
