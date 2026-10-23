import { describe, expect, it } from 'vitest';
import { type HeldImage, heldImagesBlock, imageRefusal } from '../lib/bot-images';

/**
 * What the composer holds for a message's images before the API judges
 * them, and why a message with images cannot go yet: the client says the
 * same refusals the API makes, before an upload is spent on them.
 */

const file = (type: string, size = 1024) => ({ type, size });
const held = (status: HeldImage['status']): HeldImage => ({
  key: status,
  file: new File(['x'], 'x.png', { type: 'image/png' }),
  status,
  attachmentId: status === 'ready' ? 'a1' : null,
  error: null,
});

describe('imageRefusal', () => {
  it('holds the four types a bot reads, and a file with no type for the API to judge', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp', '']) {
      expect(imageRefusal(file(type), 0, true)).toBeNull();
    }
  });

  it('refuses another type, past 5 MB and a fifth image', () => {
    expect(imageRefusal(file('image/svg+xml'), 0, true)).toBe('notSupported');
    expect(imageRefusal(file('application/pdf'), 0, true)).toBe('notSupported');
    expect(imageRefusal(file('image/png', 5 * 1024 * 1024 + 1), 0, true)).toBe('tooLarge');
    expect(imageRefusal(file('image/png'), 4, true)).toBe('tooMany');
  });

  it('refuses every image for a model that reads none, before anything else', () => {
    expect(imageRefusal(file('image/png'), 0, false)).toBe('noVision');
  });
});

describe('heldImagesBlock', () => {
  it('lets a message go with no images, or with every one stored', () => {
    expect(heldImagesBlock([], false)).toBeNull();
    expect(heldImagesBlock([held('ready'), held('ready')], true)).toBeNull();
  });

  it('holds send while one uploads or failed, or the model reads no images', () => {
    expect(heldImagesBlock([held('ready'), held('uploading')], true)).toBe('uploading');
    expect(heldImagesBlock([held('failed')], true)).toBe('failedHeld');
    expect(heldImagesBlock([held('ready')], false)).toBe('noVisionHeld');
  });
});
