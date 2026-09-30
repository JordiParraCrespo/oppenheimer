import { describe, expect, it, vi } from 'vitest';
import { requestMemo } from './request-memo';

const KEY = Symbol('test.key');
const OTHER = Symbol('test.other');

describe('requestMemo', () => {
  it('shares one in-flight computation between concurrent callers', async () => {
    const request = {};
    let resolve!: (value: string) => void;
    const compute = vi.fn(() => new Promise<string>((done) => (resolve = done)));

    const first = requestMemo(request, KEY, compute);
    const second = requestMemo(request, KEY, compute);
    resolve('value');

    expect(await Promise.all([first, second])).toEqual(['value', 'value']);
    expect(second).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('gives separate requests separate values', async () => {
    let n = 0;
    const compute = async () => ++n;

    expect(await requestMemo({}, KEY, compute)).toBe(1);
    expect(await requestMemo({}, KEY, compute)).toBe(2);
  });

  it('keeps different keys on one request independent', async () => {
    const request = {};

    expect(await requestMemo(request, KEY, async () => 'a')).toBe('a');
    expect(await requestMemo(request, OTHER, async () => 'b')).toBe('b');
    expect(await requestMemo(request, KEY, async () => 'c')).toBe('a');
  });

  it('evicts a rejection: waiting callers see it, the next caller recomputes', async () => {
    const request = {};
    const compute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    const first = requestMemo(request, KEY, compute);
    const concurrent = requestMemo(request, KEY, compute);
    await expect(first).rejects.toThrow('transient');
    await expect(concurrent).rejects.toThrow('transient');

    expect(await requestMemo(request, KEY, compute)).toBe('recovered');
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
