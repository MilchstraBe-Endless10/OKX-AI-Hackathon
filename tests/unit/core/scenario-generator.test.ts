import { describe, it, expect } from 'vitest';
import { generateScenario, type ScenarioGenerationConfig } from '@sopscape/core';
import { ScenarioSchema } from '@sopscape/contracts';

describe('generateScenario', () => {
  const validCouncil = {
    consensus: [
      {
        role: 'procedure-analyst' as const,
        claim: '不点击邮件中的链接',
        evidenceRefs: ['step-1'],
        confidence: 0.9,
        severity: 'high' as const,
        affectedStepIds: ['step-1'],
        unsupported: false,
      },
    ],
    disagreements: [
      {
        topic: '是否立即删除邮件',
        positions: [
          { role: 'procedure-analyst' as const, stance: '保留作为证据' },
          { role: 'risk-challenger' as const, stance: '立即隔离' },
        ],
      },
    ],
    evidenceGaps: [{ description: '缺少发件人域名历史记录', refs: ['sender-domain'] }],
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

  it('generates a valid scenario from council result', async () => {
    const sop = {
      title: '钓鱼邮件处置',
      content: '收到可疑邮件后：1. 不点击链接 2. 通过独立渠道核验 3. 上报安全团队',
      locale: 'zh-CN' as const,
    };

    const scenario = await generateScenario(sop, validCouncil);

    // Validate against schema
    expect(() => ScenarioSchema.parse(scenario)).not.toThrow();
    expect(scenario.title).toBe(sop.title);
    expect(scenario.phases.length).toBeGreaterThan(0);
    expect(scenario.metadata.language).toBe('zh-CN');
  });

  it('generates scenario with configured difficulty', async () => {
    const sop = {
      title: '钓鱼邮件处置',
      content: '收到可疑邮件后：不点击链接，核验，上报',
      locale: 'zh-CN' as const,
    };

    const config: ScenarioGenerationConfig = {
      difficulty: 'beginner',
      maxPhases: 3,
    };

    const scenario = await generateScenario(sop, validCouncil, config);

    expect(scenario.metadata.difficulty).toBe('beginner');
    expect(scenario.phases.length).toBeLessThanOrEqual(3);
  });

  it('generates scenario with English locale', async () => {
    const sop = {
      title: 'Phishing Email Response',
      content:
        'When receiving suspicious email: 1. Do not click links 2. Verify independently 3. Report',
      locale: 'en-US' as const,
    };

    const scenario = await generateScenario(sop, validCouncil);

    expect(scenario.metadata.language).toBe('en-US');
    expect(scenario.title).toBe(sop.title);
  });

  it('generates scenario with empty council (fallback)', async () => {
    const sop = {
      title: 'Empty Test',
      content: 'Test content',
      locale: 'zh-CN' as const,
    };

    const emptyCouncil = {
      consensus: [],
      disagreements: [],
      evidenceGaps: [],
      recommendedPath: [],
      decisionNodes: [],
    };

    const scenario = await generateScenario(sop, emptyCouncil);

    // Should fallback to phishing scenario
    expect(scenario.phases.length).toBeGreaterThan(0);
    expect(() => ScenarioSchema.parse(scenario)).not.toThrow();
  });

  it('extracts relevant tags from SOP content', async () => {
    const sop = {
      title: '钓鱼邮件安全处置',
      content:
        '收到钓鱼邮件后，不要点击密码重置链接，通过独立渠道核验发件人身份，并立即上报安全团队。保留邮件头和截图作为证据。',
      locale: 'zh-CN' as const,
    };

    const scenario = await generateScenario(sop, validCouncil);

    expect(scenario.metadata.tags.length).toBeGreaterThan(0);
    // Should extract tags like 钓鱼, 邮件, 安全, etc.
    expect(
      scenario.metadata.tags.some((tag) => ['钓鱼', '邮件', '安全', '密码', '上报'].includes(tag)),
    ).toBe(true);
  });

  it('generates scenario respecting maxPhases limit', async () => {
    const sop = {
      title: 'Complex SOP',
      content: 'Complex procedure with many steps and decisions.',
      locale: 'en-US' as const,
    };

    const config: ScenarioGenerationConfig = {
      maxPhases: 2,
    };

    const scenario = await generateScenario(sop, validCouncil, config);

    expect(scenario.phases.length).toBeLessThanOrEqual(2);
  });

  it('includes council findings in phase context', async () => {
    const sop = {
      title: '钓鱼邮件处置',
      content: '收到可疑邮件后：不点击链接，核验，上报',
      locale: 'zh-CN' as const,
    };

    const scenario = await generateScenario(sop, validCouncil);

    // First phase should include finding claim in context
    const firstPhase = scenario.phases[0];
    expect(firstPhase.context).toContain(validCouncil.consensus[0].claim);
  });

  it('generates phases with valid structure', async () => {
    const sop = {
      title: 'Test SOP',
      content: 'Test content',
      locale: 'zh-CN' as const,
    };

    const scenario = await generateScenario(sop, validCouncil);

    for (const phase of scenario.phases) {
      // Check required fields
      expect(phase.id).toBeDefined();
      expect(phase.title).toBeDefined();
      expect(phase.options.length).toBeGreaterThanOrEqual(2);
      expect(phase.correctOptionId).toBeDefined();

      // Check option structure
      for (const option of phase.options) {
        expect(option.id).toBeDefined();
        expect(option.label).toBeDefined();
        expect(option.consequence).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(option.riskLevel);
      }

      // Check scoring
      expect(phase.scoring.maxPoints).toBeGreaterThan(0);
      expect(phase.scoring.weight).toBeGreaterThanOrEqual(0);
      expect(phase.scoring.weight).toBeLessThanOrEqual(1);
    }
  });
});
