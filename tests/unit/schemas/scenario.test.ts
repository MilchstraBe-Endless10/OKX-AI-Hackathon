import { describe, it, expect } from 'vitest';
import { ScenarioSchema, ScenarioPhaseSchema } from '@sopscape/contracts';

describe('ScenarioSchema', () => {
  const validScenario = {
    id: 'scenario-1',
    sopId: 'sop-1',
    title: '钓鱼邮件处置演练',
    description: '基于 SOP "钓鱼邮件处置" 自动生成的演练场景',
    phases: [
      {
        id: 'phase-1',
        title: '接收通知',
        description: '你收到一条紧急通知，要求立即处理。',
        context: '工作时间内，你收到了来自未知发件人的紧急邮件。',
        decisionPrompt: '你应该如何行动？',
        options: [
          {
            id: 'opt-1a',
            label: '立即点击链接处理',
            consequence: '高风险操作，可能导致凭证泄漏',
            riskLevel: 'critical',
          },
          {
            id: 'opt-1b',
            label: '通过独立渠道核验',
            consequence: '安全做法，避免潜在风险',
            riskLevel: 'low',
          },
        ],
        correctOptionId: 'opt-1b',
        consequence: {
          correct: '正确！独立核验是避免钓鱼攻击的关键步骤。',
          incorrect: '危险！直接点击未知链接可能导致凭证被盗。',
          feedback: '永远不要直接点击可疑邮件中的链接。',
        },
        scoring: {
          maxPoints: 100,
          rubric: '根据安全最佳实践评分',
          weight: 1,
        },
      },
    ],
    metadata: {
      difficulty: 'intermediate' as const,
      estimatedMinutes: 3,
      tags: ['钓鱼', '邮件'],
      language: 'zh-CN',
      version: '1.0.0',
    },
    createdAt: new Date().toISOString(),
  };

  it('accepts a valid scenario', () => {
    expect(() => ScenarioSchema.parse(validScenario)).not.toThrow();
  });

  it('rejects scenario with too few phases', () => {
    const invalid = { ...validScenario, phases: [] };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('rejects scenario with too many phases (>20)', () => {
    const oversized = Array.from({ length: 21 }, (_, i) => ({
      ...validScenario.phases[0],
      id: `phase-${i + 1}`,
    }));
    const invalid = { ...validScenario, phases: oversized };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('rejects phase with too few options (<2)', () => {
    const invalid = {
      ...validScenario,
      phases: [
        {
          ...validScenario.phases[0],
          options: [{ ...validScenario.phases[0].options[0] }],
        },
      ],
    };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('rejects phase with too many options (>6)', () => {
    const oversizedOptions = Array.from({ length: 7 }, (_, i) => ({
      ...validScenario.phases[0].options[0],
      id: `opt-${i}`,
    }));
    const invalid = {
      ...validScenario,
      phases: [
        {
          ...validScenario.phases[0],
          options: oversizedOptions,
        },
      ],
    };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid risk level', () => {
    const invalid = {
      ...validScenario,
      phases: [
        {
          ...validScenario.phases[0],
          options: [
            {
              ...validScenario.phases[0].options[0],
              riskLevel: 'extreme',
            },
          ],
        },
      ],
    };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('rejects non-numeric maxPoints', () => {
    const invalid = {
      ...validScenario,
      phases: [
        {
          ...validScenario.phases[0],
          scoring: {
            ...validScenario.phases[0].scoring,
            maxPoints: '100',
          },
        },
      ],
    };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('rejects weight outside [0, 1]', () => {
    const invalid = {
      ...validScenario,
      phases: [
        {
          ...validScenario.phases[0],
          scoring: {
            ...validScenario.phases[0].scoring,
            weight: 1.5,
          },
        },
      ],
    };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });

  it('accepts valid difficulty levels', () => {
    for (const difficulty of ['beginner', 'intermediate', 'advanced'] as const) {
      const scenario = {
        ...validScenario,
        metadata: { ...validScenario.metadata, difficulty },
      };
      expect(() => ScenarioSchema.parse(scenario)).not.toThrow();
    }
  });

  it('rejects invalid difficulty level', () => {
    const invalid = {
      ...validScenario,
      metadata: { ...validScenario.metadata, difficulty: 'expert' },
    };
    expect(() => ScenarioSchema.parse(invalid)).toThrow();
  });
});

describe('ScenarioPhaseSchema', () => {
  const validPhase = {
    id: 'phase-1',
    title: '阶段 1',
    description: '描述',
    context: '情境',
    decisionPrompt: '请选择：',
    options: [
      {
        id: 'opt-1',
        label: '选项 A',
        consequence: '后果 A',
        riskLevel: 'low',
      },
      {
        id: 'opt-2',
        label: '选项 B',
        consequence: '后果 B',
        riskLevel: 'high',
      },
    ],
    correctOptionId: 'opt-2',
    consequence: {
      correct: '正确后果',
      incorrect: '错误后果',
      feedback: '反馈',
    },
    scoring: {
      maxPoints: 100,
      rubric: '评分标准',
      weight: 0.5,
    },
  };

  it('accepts a valid phase', () => {
    expect(() => ScenarioPhaseSchema.parse(validPhase)).not.toThrow();
  });

  it('requires all mandatory fields', () => {
    const { id: _id, ...withoutId } = validPhase;
    expect(() => ScenarioPhaseSchema.parse(withoutId)).toThrow();
  });

  it('accepts optional fields', () => {
    const withOptional = {
      ...validPhase,
      requiredEvidence: ['step-1', 'step-2'],
      timeoutSeconds: 60,
    };
    expect(() => ScenarioPhaseSchema.parse(withOptional)).not.toThrow();
  });
});
