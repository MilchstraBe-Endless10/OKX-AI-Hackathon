import { describe, it, expect } from 'vitest';
import { ApiErrorSchema } from '@sopscape/contracts';

describe('ApiErrorSchema', () => {
  it('accepts a retryable error', () => {
    const error = {
      code: 'GENERATION_TIMEOUT',
      message: '生成超时，请重试',
      retryable: true,
      requestId: 'req_abc123',
    };
    expect(() => ApiErrorSchema.parse(error)).not.toThrow();
  });

  it('accepts a non-retryable error', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: '输入内容不合法',
      retryable: false,
      requestId: 'req_xyz789',
    };
    expect(() => ApiErrorSchema.parse(error)).not.toThrow();
  });

  it('rejects empty code', () => {
    const error = { code: '', message: 'x', retryable: false, requestId: 'r1' };
    expect(() => ApiErrorSchema.parse(error)).toThrow();
  });

  it('rejects empty message', () => {
    const error = { code: 'X', message: '', retryable: false, requestId: 'r1' };
    expect(() => ApiErrorSchema.parse(error)).toThrow();
  });

  it('rejects non-boolean retryable', () => {
    const error = { code: 'X', message: 'y', retryable: 'yes', requestId: 'r1' };
    expect(() => ApiErrorSchema.parse(error)).toThrow();
  });

  it('rejects empty requestId', () => {
    const error = { code: 'X', message: 'y', retryable: false, requestId: '' };
    expect(() => ApiErrorSchema.parse(error)).toThrow();
  });

  it('rejects unknown keys', () => {
    const error = { code: 'X', message: 'y', retryable: false, requestId: 'r1', stackTrace: '...' };
    expect(() => ApiErrorSchema.parse(error)).toThrow();
  });
});
