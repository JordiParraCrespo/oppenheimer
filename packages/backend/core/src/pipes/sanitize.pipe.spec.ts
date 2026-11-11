import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SanitizePipe } from './sanitize.pipe';

const pipe = new SanitizePipe();

const from = (type: ArgumentMetadata['type']): ArgumentMetadata => ({ type });

describe('SanitizePipe', () => {
  it('strips HTML out of a body, at any depth', () => {
    const body = {
      name: '<b>Acme</b>',
      nested: { note: 'a <script>x</script> b' },
      tags: ['<i>a'],
    };

    expect(pipe.transform(body, from('body'))).toEqual({
      name: 'Acme',
      nested: { note: 'a x b' },
      tags: ['a'],
    });
  });

  it('strips spans and stray brackets the way the tag pattern did', () => {
    const tagPattern = (input: string) => input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
    for (const input of ['a < b > c', '<<a>b>', 'x<y', '>>a<', '<a><b>c</b>', 'no tags', '']) {
      expect(pipe.transform(input, from('body'))).toBe(tagPattern(input));
    }
  });

  it('strips a large body of unclosed brackets in linear time', () => {
    // The regex it replaced took about 19 s on this; any linear scan takes milliseconds.
    const started = performance.now();
    pipe.transform('a<'.repeat(500_000), from('body'));
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('strips HTML out of query and route parameters too', () => {
    expect(pipe.transform('<b>x</b>', from('query'))).toBe('x');
    expect(pipe.transform('<b>x</b>', from('param'))).toBe('x');
  });

  it('leaves a custom parameter exactly as the decorator produced it', () => {
    // These do not come off the wire: they are what a `createParamDecorator`
    // read off the request. Rebuilding them through `Object.entries` turned a
    // `Map` into `{}` and a class instance into a prototype-less bag, which is
    // how an access scope reached a repository with no `grants.get`.
    const scope = { userId: 'u1', grants: new Map([['Host', new Set(['host-1'])]]) };

    const sanitized = pipe.transform(scope, from('custom')) as typeof scope;

    expect(sanitized).toBe(scope);
    expect(sanitized.grants.get('Host')).toEqual(new Set(['host-1']));
  });

  it('leaves values it cannot improve alone', () => {
    expect(pipe.transform(42, from('body'))).toBe(42);
    expect(pipe.transform(null, from('body'))).toBeNull();
    expect(pipe.transform(undefined, from('body'))).toBeUndefined();
  });
});
