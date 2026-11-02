import { fitsPromptBound } from '@oppenheimer/shared';
import { describe, expect, it, vi } from 'vitest';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import type { CloudFilesPort } from '../cloud-files.port';
import { CloudTaskFactory } from '../cloud-task.factory';

/**
 * What a create measures and what a launch sends are one string: the task
 * with a link per file, built by `cloudTaskWithFiles` from links of the real
 * shape. A task the check lets through therefore fits once its real links are
 * minted. The create's refusal and what the log records are the handler's.
 */

function files(origin: string) {
  let minted = 0;
  return {
    keep: vi.fn(),
    // Every link the same length as the sample, as the adapter's are.
    link: vi.fn(async () => `${origin}/api/v1/cloud-files/${String(++minted).padStart(36, '0')}`),
    sampleLink: () => `${origin}/api/v1/cloud-files/${'0'.repeat(36)}`,
    open: vi.fn(),
  } satisfies CloudFilesPort;
}

function session(place: 'cloud' | 'worktree') {
  return WorkSessionEntity.request({
    organizationId: 'org',
    projectId: 'project',
    createdByUserId: 'user',
    hostId: 'host',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    place,
  });
}

const png = { imageId: 'kept-1', mediaType: 'image/png' as const };

describe('CloudTaskFactory', () => {
  it('lets through a task whose real links fit, and refuses one a longer origin pushes past 2 KB', async () => {
    const short = new CloudTaskFactory(files('https://api.io'));
    const long = new CloudTaskFactory(files(`https://${'a'.repeat(120)}.example.com`));
    // Just under the bound with the short origin's link.
    let prompt = 'x';
    while (short.fits(`${prompt}x`, [png])) prompt += 'x';

    expect(short.fits(prompt, [png])).toBe(true);
    expect(long.fits(prompt, [png])).toBe(false);
    const sent = await short.forLaunch(session('cloud'), { prompt, images: [png] });
    expect(fitsPromptBound(sent.prompt ?? '')).toBe(true);
  });

  it('sends a cloud session’s files as fresh links in its task, and none as a file', async () => {
    const tasks = new CloudTaskFactory(files('https://api.io'));

    const first = await tasks.forLaunch(session('cloud'), { prompt: 'look', images: [png] });
    const again = await tasks.forLaunch(session('cloud'), { prompt: 'look', images: [png] });

    expect(first.images).toBeUndefined();
    expect(first.prompt).toMatch(/^look\n/);
    expect(first.prompt).toContain('-o /tmp/attachments/1.png');
    expect(again.prompt).not.toBe(first.prompt);
  });

  it('sends any other session’s task and files as they are', async () => {
    const tasks = new CloudTaskFactory(files('https://api.io'));
    const task = { prompt: 'look', images: [png] };

    await expect(tasks.forLaunch(session('worktree'), task)).resolves.toBe(task);
  });
});
