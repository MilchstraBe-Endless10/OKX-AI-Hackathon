import { describe, expect, it } from 'vitest';
import type { CouncilResult } from '@sopscape/contracts';
import {
  compareSopVersions,
  computeReadiness,
  ensurePhishingScenario,
  evaluateDecision,
} from '../../../apps/server/src/product.js';

const council: CouncilResult = {
  consensus: [
    {
      role: 'procedure-analyst',
      claim: '先核验发件人身份',
      evidenceRefs: ['step-1'],
      confidence: 0.92,
      severity: 'medium',
      affectedStepIds: ['step-1'],
      unsupported: false,
    },
    {
      role: 'risk-challenger',
      claim: '不得直接点击邮件链接',
      evidenceRefs: ['step-2'],
      confidence: 0.96,
      severity: 'critical',
      affectedStepIds: ['step-2'],
      unsupported: false,
    },
  ],
  disagreements: [],
  evidenceGaps: [],
  recommendedPath: ['通过独立渠道核验', '上报安全团队'],
  decisionNodes: [
    {
      id: 'email-action',
      prompt: '收到紧急重置密码邮件怎么办？',
      options: [
        { id: 'click-link', label: '点击邮件链接', consequence: '凭证可能泄漏' },
        { id: 'verify-report', label: '独立核验并上报', consequence: '阻断攻击并保留证据' },
      ],
    },
  ],
};

describe('product decision loop', () => {
  it('blocks publication when critical findings are unresolved', () => {
    const passport = computeReadiness(council, '收到邮件后先核验，再上报安全团队。');
    expect(passport.verdict).toBe('BLOCK');
    expect(passport.score).toBeLessThan(60);
    expect(passport.blockers.length).toBeGreaterThan(0);
  });

  it('scores unsafe and safe branches deterministically', () => {
    const unsafe = evaluateDecision(council.decisionNodes[0]!, 'click-link');
    const safe = evaluateDecision(council.decisionNodes[0]!, 'verify-report');
    expect(unsafe.scoreDelta).toBeLessThan(0);
    expect(safe.scoreDelta).toBeGreaterThan(0);
    expect(safe.riskLevel).toBe('low');
  });

  it('reports version drift and changed lines', () => {
    const comparison = compareSopVersions(
      '1. 不点击链接\n2. 上报安全团队',
      '1. 点击链接验证\n2. 输入密码',
      { score: 88, verdict: 'READY' },
      { score: 32, verdict: 'BLOCK' },
    );
    expect(comparison.changedLines).toBeGreaterThan(0);
    expect(comparison.riskDelta).toBe(-56);
    expect(comparison.regressed).toBe(true);
  });

  it('builds a three-stage phishing rehearsal with unsafe and safe branches', () => {
    const scenario = ensurePhishingScenario(council);
    expect(scenario.decisionNodes).toHaveLength(3);
    expect(scenario.decisionNodes.map((node) => node.id)).toEqual([
      'phishing-sender',
      'phishing-link',
      'phishing-report',
    ]);
    scenario.decisionNodes.forEach((node) => expect(node.options).toHaveLength(2));
  });
});
