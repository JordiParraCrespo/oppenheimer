/**
 * The QR encoder, loaded the first time a code is drawn so it stays off the
 * console's first load. Kept out of the hook that calls it: the React
 * Compiler does not lower an `import()` and would leave the hook uncompiled.
 */
export async function encodeQr(text: string): Promise<readonly (readonly boolean[])[]> {
  const { encode } = await import('uqr');
  return encode(text, { ecc: 'L', border: 2 }).data;
}
