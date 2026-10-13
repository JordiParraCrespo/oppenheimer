import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * With the WebGL renderer, the typeahead draws a guess on its own canvas with
 * the rule `@xterm/addon-webgl` places glyphs by (`canvasPainter` in
 * `typeahead-paint.ts`): the character box is the face's font bounding box,
 * `ceil(height × dpr)` device pixels tall, centred with `round` in a cell
 * `floor(box × lineHeight)` tall, and each glyph is drawn with the
 * ideographic baseline (Firefox: bottom) at the box's foot. xterm exposes
 * none of it, and the WebGL canvas cannot be read back, so the rule is
 * restated there.
 *
 * The regression this guards is an xterm upgrade that changes the rule: the
 * guess would sit off the host's echo again, and each letter would drop into
 * place when the echo arrived. On a bump that fails here, read the lines
 * below in the new version, make `canvasPainter` follow them, and update
 * this spec.
 */
describe('the WebGL glyph placement the typeahead follows', () => {
  const require = createRequire(import.meta.url);
  const webgl = join(dirname(require.resolve('@xterm/addon-webgl')), '..', 'src');
  const xterm = join(dirname(require.resolve('@xterm/xterm')), '..', 'src');
  const read = (path: string) => readFileSync(path, 'utf8');

  it('measures the character box as the font bounding box', () => {
    expect(read(join(xterm, 'browser/services/CharSizeService.ts'))).toContain(
      'metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent',
    );
  });

  it('sizes and centres the box in the cell', () => {
    const renderer = read(join(webgl, 'WebglRenderer.ts'));
    expect(renderer).toContain(
      'this.dimensions.device.char.height = Math.ceil(this._charSizeService.height * this._devicePixelRatio);',
    );
    expect(renderer).toContain(
      'this.dimensions.device.cell.height = Math.floor(this.dimensions.device.char.height * this._optionsService.rawOptions.lineHeight);',
    );
    expect(renderer).toContain(
      'this.dimensions.device.char.top = this._optionsService.rawOptions.lineHeight === 1 ? 0 : Math.round((this.dimensions.device.cell.height - this.dimensions.device.char.height) / 2);',
    );
  });

  it('draws each glyph on the ideographic baseline at the foot of the box', () => {
    expect(read(join(webgl, 'Constants.ts'))).toContain(
      "TEXT_BASELINE: CanvasTextBaseline = isFirefox || isLegacyEdge ? 'bottom' : 'ideographic';",
    );
    const atlas = read(join(webgl, 'TextureAtlas.ts'));
    expect(atlas).toContain('this._tmpCtx.textBaseline = TEXT_BASELINE;');
    expect(atlas).toContain(
      'this._tmpCtx.fillText(chars, padding, padding + this._config.deviceCharHeight);',
    );
  });
});
