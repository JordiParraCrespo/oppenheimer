import { describe, expect, it } from 'vitest';
import { webglAllowed } from '../lib/terminal-webgl-policy';

/**
 * On Linux a software GL stack keeps the WebGL context alive while the glyph
 * atlas draws letters as blocks, and never reports a loss to fall back on.
 * The regression this guards is a Linux reader landing on WebGL anyway.
 */
describe('webglAllowed', () => {
  const never = () => {
    throw new Error('the GL stack is only probed on Linux');
  };

  it('keeps WebGL everywhere but Linux, without probing the GPU', () => {
    expect(webglAllowed({ linux: false }, never)).toBe(true);
  });

  it('keeps WebGL on Linux for a hardware renderer that names itself', () => {
    const gl = () => ({
      webgl2: true,
      identity: 'Google Inc. (NVIDIA) ANGLE (NVIDIA GeForce RTX 3070)',
    });
    expect(webglAllowed({ linux: true }, gl)).toBe(true);
  });

  it('draws with the DOM on Linux when the renderer is software', () => {
    for (const identity of [
      'Google Inc. (Google) ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
      'Mesa llvmpipe (LLVM 15.0.7, 256 bits)',
      'Mesa virgl',
    ]) {
      expect(
        webglAllowed({ linux: true }, () => ({ webgl2: true, identity })),
        identity,
      ).toBe(false);
    }
  });

  it('draws with the DOM on Linux when the renderer cannot be told apart', () => {
    // A browser that withholds WEBGL_debug_renderer_info, or has no WebGL2.
    expect(webglAllowed({ linux: true }, () => ({ webgl2: true, identity: null }))).toBe(false);
    expect(webglAllowed({ linux: true }, () => ({ webgl2: false, identity: null }))).toBe(false);
  });
});
