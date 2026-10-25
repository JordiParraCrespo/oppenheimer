import { describe, expect, it, vi } from 'vitest';
import { takeFilePaste } from '../lib/terminal-files';

/**
 * A paste on a running session, on the grid or in the chat's composer, takes
 * its files to the host and keeps them out of the field it landed in. The
 * chat's composer once took none: typing in it moved focus off the grid, so
 * a screenshot pasted after a few words went nowhere.
 */

function paste(files: File[], text = '') {
  return {
    clipboardData: {
      items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
      files,
      getData: () => text,
    } as unknown as DataTransfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

const shot = new File([new Uint8Array([0x89, 0x50])], 'shot.png', { type: 'image/png' });
const zip = new File(['PK'], 'a.zip', { type: 'application/zip' });

describe('takeFilePaste', () => {
  it('hands the files to the upload and keeps the paste out of the field', () => {
    const event = paste([shot], 'https://example.com/shot.png');
    const onFiles = vi.fn();
    takeFilePaste(event, onFiles);
    expect(onFiles).toHaveBeenCalledWith([shot]);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('leaves a paste of text, or of files a session does not take, to the field', () => {
    const onFiles = vi.fn();
    for (const event of [paste([], 'hello'), paste([zip])]) {
      takeFilePaste(event, onFiles);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(onFiles).not.toHaveBeenCalled();
  });
});
