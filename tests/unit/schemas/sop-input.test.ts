import { describe, it, expect } from 'vitest';
import { SopInputSchema } from '@sopscape/contracts';

describe('SopInputSchema', () => {
  it('accepts a minimal valid input', () => {
    const input = { title: '钓鱼邮件处置 SOP', content: '当收到疑似钓鱼邮件时，请勿点击链接。' };
    expect(() => SopInputSchema.parse(input)).not.toThrow();
  });

  it('accepts locale and scenarioMetadata', () => {
    const input = {
      title: 'Phishing Response',
      content: 'Do not click links in suspicious emails.',
      locale: 'en-US',
      scenarioMetadata: { domain: 'phishing', urgency: 'high' },
    };
    expect(() => SopInputSchema.parse(input)).not.toThrow();
  });

  it('rejects empty title', () => {
    expect(() => SopInputSchema.parse({ title: '', content: 'x' })).toThrow();
  });

  it('rejects empty content', () => {
    expect(() => SopInputSchema.parse({ title: 'ok', content: '' })).toThrow();
  });

  it('rejects content over 60,000 UTF-8 bytes', () => {
    // 20,001 CJK chars × 3 bytes = 60,003 bytes > 60,000
    const content = '你'.repeat(20001);
    expect(() => SopInputSchema.parse({ title: 'oversize', content })).toThrow();
  });

  it('accepts content exactly at 60,000 UTF-8 byte limit', () => {
    // 20,000 CJK chars × 3 bytes = 60,000 bytes exactly
    const content = '你'.repeat(20000);
    expect(() => SopInputSchema.parse({ title: 'limit', content })).not.toThrow();
  });

  it('rejects unknown top-level keys', () => {
    const input = { title: 'x', content: 'y', evil: true };
    expect(() => SopInputSchema.parse(input)).toThrow();
  });

  it('rejects invalid urgency value', () => {
    const input = {
      title: 'x',
      content: 'y',
      scenarioMetadata: { urgency: 'critical' },
    };
    expect(() => SopInputSchema.parse(input)).toThrow();
  });
});
