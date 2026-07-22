import { describe, expect, test } from 'vitest';
import { LOCALES, getMessages, resolveTheme } from './preferences';

describe('locale catalogue', () => {
  test('provides ten complete language packs', () => {
    expect(LOCALES).toHaveLength(10);
    const baseline = Object.keys(getMessages('en-US')).sort();
    for (const locale of LOCALES) {
      const messages = getMessages(locale.code);
      expect(Object.keys(messages).sort()).toEqual(baseline);
      expect(Object.values(messages).every(Boolean)).toBe(true);
    }
  });
});

describe('resolveTheme', () => {
  test('supports light, dark and system modes', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
