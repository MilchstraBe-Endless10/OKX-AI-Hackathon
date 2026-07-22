import { describe, it, expect } from 'vitest';
import { DecisionInputSchema, DecisionResultSchema } from '@sopscape/contracts';

describe('DecisionInputSchema', () => {
  it('accepts a valid decision input', () => {
    const input = { nodeId: 'link-click', choiceId: 'verify', expectedVersion: 3 };
    expect(() => DecisionInputSchema.parse(input)).not.toThrow();
  });

  it('rejects negative expectedVersion', () => {
    const input = { nodeId: 'link-click', choiceId: 'verify', expectedVersion: -1 };
    expect(() => DecisionInputSchema.parse(input)).toThrow();
  });

  it('rejects missing nodeId', () => {
    const input = { choiceId: 'verify', expectedVersion: 1 };
    expect(() => DecisionInputSchema.parse(input)).toThrow();
  });
});

describe('DecisionResultSchema', () => {
  it('accepts a valid decision result', () => {
    const result = {
      version: 4,
      confidence: 0.92,
      topology: { updatedNodes: ['ev-1'], removedPaths: ['rp-1'] },
      consequence: { summary: '安全核验路径已确认', nextAction: '继续上报安全团队' },
    };
    expect(() => DecisionResultSchema.parse(result)).not.toThrow();
  });

  it('rejects confidence outside [0, 1]', () => {
    const result = {
      version: 4,
      confidence: 1.5,
      topology: { updatedNodes: [], removedPaths: [] },
      consequence: { summary: 'x', nextAction: 'y' },
    };
    expect(() => DecisionResultSchema.parse(result)).toThrow();
  });

  it('rejects zero version (must increment)', () => {
    const result = {
      version: 0,
      confidence: 0.5,
      topology: { updatedNodes: [], removedPaths: [] },
      consequence: { summary: 'x', nextAction: 'y' },
    };
    expect(() => DecisionResultSchema.parse(result)).toThrow();
  });
});
