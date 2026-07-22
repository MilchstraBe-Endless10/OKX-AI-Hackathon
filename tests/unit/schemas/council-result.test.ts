import { describe, it, expect } from 'vitest';
import { CouncilResultSchema } from '@sopscape/contracts';

const validResult = {
  consensus: [
    {
      role: 'procedure-analyst',
      claim: '不点击邮件中的链接',
      evidenceRefs: ['step-1'],
      confidence: 0.9,
      severity: 'high',
      affectedStepIds: ['step-1'],
    },
  ],
  disagreements: [],
  evidenceGaps: [],
  recommendedPath: ['verify-sender', 'report-to-security'],
  decisionNodes: [
    {
      id: 'link-click',
      prompt: '是否点击邮件中的密码重置链接？',
      options: [
        { id: 'click', label: '直接点击', consequence: 'high-risk' },
        { id: 'verify', label: '独立核验后上报', consequence: 'safe' },
      ],
    },
  ],
};

describe('CouncilResultSchema', () => {
  it('accepts a valid result with consensus', () => {
    expect(() => CouncilResultSchema.parse(validResult)).not.toThrow();
  });

  it('accepts a result with disagreements and evidence gaps', () => {
    const input = {
      ...validResult,
      disagreements: [
        {
          topic: '是否立即删除邮件',
          positions: [
            { role: 'procedure-analyst', stance: '保留作为证据' },
            { role: 'risk-challenger', stance: '立即隔离' },
          ],
        },
      ],
      evidenceGaps: [{ description: '缺少发件人域名历史记录', refs: ['sender-domain'] }],
    };
    expect(() => CouncilResultSchema.parse(input)).not.toThrow();
  });

  it('rejects empty consensus array', () => {
    const input = { ...validResult, consensus: [] };
    expect(() => CouncilResultSchema.parse(input)).toThrow();
  });

  it('rejects confidence outside [0, 1]', () => {
    const input = {
      ...validResult,
      consensus: [{ ...validResult.consensus[0], confidence: 1.5 }],
    };
    expect(() => CouncilResultSchema.parse(input)).toThrow();
  });

  it('rejects unknown severity', () => {
    const input = {
      ...validResult,
      consensus: [{ ...validResult.consensus[0], severity: 'extreme' }],
    };
    expect(() => CouncilResultSchema.parse(input)).toThrow();
  });

  it('rejects decision node without options', () => {
    const input = {
      ...validResult,
      decisionNodes: [{ id: 'x', prompt: 'p', options: [] }],
    };
    expect(() => CouncilResultSchema.parse(input)).toThrow();
  });
});
