import { describe, expect, it } from 'vitest';
import { likeContains } from '../like-contains';

describe('likeContains', () => {
  it('wraps plain text in wildcards', () => {
    expect(likeContains('ada')).toBe('%ada%');
  });

  it('escapes the percent sign', () => {
    expect(likeContains('50%')).toBe('%50\\%%');
  });

  it('escapes the underscore', () => {
    expect(likeContains('a_b')).toBe('%a\\_b%');
  });

  it('escapes the escape character itself', () => {
    expect(likeContains('a\\b')).toBe('%a\\\\b%');
  });

  it('escapes every occurrence', () => {
    expect(likeContains('%_%_')).toBe('%\\%\\_\\%\\_%');
  });
});
