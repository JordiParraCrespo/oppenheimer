import { describe, expect, it, vi } from 'vitest';
import type { AttachmentSink } from '../../links/application/link-registry.port';
import { LinkAttachments } from '../infrastructure/link-attachments.util';

function sink(): AttachmentSink {
  return { deliver: vi.fn(), closed: vi.fn(), refused: vi.fn() };
}

describe('LinkAttachments', () => {
  it('hands out ids from 1 and never reuses an open one', () => {
    const table = new LinkAttachments();
    const a = table.open(sink(), 'cmd-a');
    const b = table.open(sink(), 'cmd-b');
    expect(a).toBe(1);
    expect(b).toBe(2);
    table.close(a);
    expect(table.open(sink(), 'cmd-c')).toBe(3);
    expect(table.size).toBe(2);
  });

  it('finds the sink an attach command opened, so a refusal reaches it', () => {
    const table = new LinkAttachments();
    const waiting = sink();
    table.open(waiting, 'cmd-a');
    expect(table.byCommandId('cmd-a')).toBe(waiting);
    expect(table.byCommandId('cmd-x')).toBeUndefined();
  });

  it('forgets the command with the attachment', () => {
    const table = new LinkAttachments();
    const id = table.open(sink(), 'cmd-a');
    table.close(id);
    expect(table.byCommandId('cmd-a')).toBeUndefined();
    expect(table.get(id)).toBeUndefined();
  });

  it('drains everything when the link goes', () => {
    const table = new LinkAttachments();
    const first = sink();
    const second = sink();
    table.open(first, 'a');
    table.open(second, 'b');
    expect(table.drain()).toEqual([first, second]);
    expect(table.size).toBe(0);
  });
});
