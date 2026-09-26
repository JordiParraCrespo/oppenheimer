/**
 * What counts as an image a session can take, once, for both sides of the
 * link.
 *
 * The control plane judges an upload by it before anything is sent, and the
 * runner judges the bytes it pulled by it again before anything is written.
 * The runner's copy is **generated** from this table
 * (`scripts/emit-session-image.cjs` →
 * `apps/runner/internal/sessions/domain/session_image.gen.go`), so the two can
 * only disagree about what an image is when somebody forgets to build.
 *
 * A type is known by its magic bytes, never by the label a browser gave the
 * file. A type matches when **any** of its signatures does; a signature is
 * every one of its parts matching at its offset.
 */

interface SignaturePart {
  offset: number;
  bytes: readonly number[];
}

export interface SessionImageType {
  mediaType: string;
  /** What the runner names the file with, so the agent reads the path as an image. */
  extension: string;
  signatures: readonly (readonly SignaturePart[])[];
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export const SESSION_IMAGE_TYPES = [
  {
    mediaType: 'image/png',
    extension: '.png',
    signatures: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  },
  {
    mediaType: 'image/jpeg',
    extension: '.jpg',
    signatures: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  {
    mediaType: 'image/gif',
    extension: '.gif',
    signatures: [[{ offset: 0, bytes: ascii('GIF87a') }], [{ offset: 0, bytes: ascii('GIF89a') }]],
  },
  {
    mediaType: 'image/webp',
    extension: '.webp',
    signatures: [
      [
        { offset: 0, bytes: ascii('RIFF') },
        { offset: 8, bytes: ascii('WEBP') },
      ],
    ],
  },
] as const satisfies readonly SessionImageType[];

export type SessionImageMediaType = (typeof SESSION_IMAGE_TYPES)[number]['mediaType'];

export const SESSION_IMAGE_MEDIA_TYPES = SESSION_IMAGE_TYPES.map(
  (type) => type.mediaType,
) as readonly SessionImageMediaType[];

/**
 * The largest image a session takes. It is the upload's cap — the control
 * plane refuses more before storing it, and the runner reads no more than
 * this when it pulls one — not a property of the link, which never carries
 * the bytes.
 */
export const SESSION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** The type an image's bytes declare, or `null` when they declare none of the table's. */
export function sniffSessionImage(bytes: Uint8Array): SessionImageMediaType | null {
  const matches = (part: SignaturePart) =>
    part.bytes.every((byte, i) => bytes[part.offset + i] === byte);
  for (const type of SESSION_IMAGE_TYPES) {
    if (type.signatures.some((signature) => signature.every(matches))) return type.mediaType;
  }
  return null;
}
