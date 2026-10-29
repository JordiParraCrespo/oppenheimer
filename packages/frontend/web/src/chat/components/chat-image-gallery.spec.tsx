import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatImageGallery } from './chat-image-gallery';

/**
 * A chat's images open where they are, the way Claude's chat shows them.
 * The regressions this guards: a tile that sends the reader to a new tab,
 * a viewer that cannot reach the message's other images, and a tile still
 * loading (or that failed) that opens onto nothing.
 */

afterEach(cleanup);

const images = [
  { key: 'a', name: 'before.png', src: 'data:image/png;base64,AAAA' },
  { key: 'b', name: 'after.png', src: 'data:image/png;base64,BBBB' },
  { key: 'c', name: 'loading.png' },
];

describe('ChatImageGallery', () => {
  it('opens a tile in the viewer and goes through the others with the arrows', () => {
    render(<ChatImageGallery images={images} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    // The tile that has not loaded is no button: there is nothing to open.
    expect(screen.getAllByRole('button')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    const viewer = screen.getByRole('dialog');
    expect(viewer.querySelector('[data-slot="chat-image-viewer-image"]')?.getAttribute('src')).toBe(
      images[0]?.src,
    );

    fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('alt')).toBe('after.png');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    // Round the end and back to the first.
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('alt')).toBe('before.png');
  });

  it('offers the open image to save, under its own name', () => {
    render(<ChatImageGallery images={images.slice(1, 2)} />);
    fireEvent.click(screen.getByRole('button'));
    const save = screen.getByRole('dialog').querySelector('a[download]');
    expect(save?.getAttribute('download')).toBe('after.png');
    expect(save?.getAttribute('href')).toBe(images[1]?.src);
  });
});
