/** Ogg/Opus built byte by byte, for the specs that judge spoken audio. */

/** One Ogg page: its granule position and one segment of body. */
export function oggPage(granule: number, body: Buffer): Buffer {
  const head = Buffer.alloc(27);
  head.write('OggS', 0, 'ascii');
  head.writeBigInt64LE(BigInt(granule), 6);
  head[26] = 1;
  return Buffer.concat([head, Buffer.from([body.length]), body]);
}

/** The Opus identification header with a pre-skip of 312 samples, as encoders write it. */
function opusHead(): Buffer {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0, 'ascii');
  head[8] = 1;
  head[9] = 1;
  head.writeUInt16LE(312, 10);
  return head;
}

/** Ogg/Opus that ends at `granule`: the header page, a tags page, a sound page. */
export function oggOpus(granule: number): Buffer {
  return Buffer.concat([
    oggPage(0, opusHead()),
    oggPage(0, Buffer.from('OpusTags')),
    oggPage(granule, Buffer.from('sound')),
  ]);
}
