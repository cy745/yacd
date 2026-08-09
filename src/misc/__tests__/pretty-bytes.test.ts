// pretty-bytes 纯函数单测(无 DOM,秒级)
import { describe, expect,it } from 'vitest';

import prettyBytes from '../pretty-bytes';

describe('prettyBytes', () => {
  it('小于 1000 显示 B', () => {
    expect(prettyBytes(0)).toBe('0 B');
    expect(prettyBytes(999)).toBe('999 B');
  });

  it('KB 单位', () => {
    expect(prettyBytes(1000)).toBe('1 KB');
    expect(prettyBytes(1234)).toBe('1.23 KB');
    // 999999 是 1000KB 边界,原库行为返回 '1000 KB'(未进位)
    expect(prettyBytes(999999)).toBe('1000 KB');
  });

  it('MB/GB 单位', () => {
    expect(prettyBytes(1024 * 1024)).toBe('1.05 MB');
    expect(prettyBytes(5 * 1024 * 1024 * 1024)).toBe('5.37 GB');
  });

  it('极端大值不越界(UNITS 数组封顶)', () => {
    // MAX_SAFE_INTEGER ≈ 9.007e15 → PB 量级(UNITS[5])
    expect(prettyBytes(Number.MAX_SAFE_INTEGER)).toMatch(/PB$/);
    expect(prettyBytes(1e30)).toMatch(/YB$/);
  });
});
