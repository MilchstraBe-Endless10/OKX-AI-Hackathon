// @sopscape/core — scenario generation from SOP content
// ponytail: minimal scenario generation — uses fixed fallback, LLM integration later.

import { type CouncilResult, type Scenario, type ScenarioPhase } from '@sopscape/contracts';

export interface ScenarioGenerationConfig {
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  maxPhases?: number;
}

/**
 * Generates a ScenarioSchema-compliant scenario from SOP input.
 * Currently uses fixed phishing scenario as fallback.
 * LLM-based generation will be added when real provider is configured.
 */
export async function generateScenario(
  sop: { title: string; content: string; locale?: string },
  council: CouncilResult,
  config?: ScenarioGenerationConfig,
): Promise<Scenario> {
  const maxPhases = config?.maxPhases ?? 5;
  const difficulty = config?.difficulty ?? 'intermediate';

  // Extract tags from SOP content
  const tags = extractTags(sop.content);

  // Generate phases based on council findings
  const phases = generatePhasesFromCouncil(council, maxPhases);

  return {
    id: `scenario-${Date.now()}`,
    title: sop.title,
    description: `基于 SOP "${sop.title}" 生成的演练场景`,
    phases,
    metadata: {
      difficulty,
      estimatedMinutes: phases.length * 3,
      tags,
      language: sop.locale ?? 'zh-CN',
      version: '1.0.0',
    },
    createdAt: new Date().toISOString(),
  } as Scenario;
}

function generatePhasesFromCouncil(council: CouncilResult, maxPhases: number): ScenarioPhase[] {
  const phases: ScenarioPhase[] = [];

  // Phase 1: Initial assessment based on first finding
  const firstFinding = council.consensus[0];
  if (firstFinding) {
    phases.push({
      id: 'phase-1',
      title: '初步评估',
      description: `根据${firstFinding.role}的分析，需要进行初步评估。`,
      context: firstFinding.claim,
      decisionPrompt: '你应该如何行动？',
      options: [
        {
          id: 'opt-1a',
          label: '立即执行 SOP',
          consequence: '快速响应，但可能存在风险',
          riskLevel:
            firstFinding.severity === 'high' || firstFinding.severity === 'critical'
              ? 'high'
              : 'medium',
        },
        {
          id: 'opt-1b',
          label: '独立核验后执行',
          consequence: '安全做法，避免潜在风险',
          riskLevel: 'low',
        },
      ],
      correctOptionId: 'opt-1b',
      consequence: {
        correct: '正确！独立核验是避免风险的关键步骤。',
        incorrect: '危险！未经核验直接执行可能导致问题。',
        feedback: firstFinding.claim,
      },
      scoring: {
        maxPoints: 100,
        rubric: '根据安全最佳实践评分',
        weight: 1,
      },
    });
  }

  // Phase 2: Risk assessment if there are disagreements
  if (council.disagreements.length > 0 && phases.length < maxPhases) {
    phases.push({
      id: 'phase-2',
      title: '风险评估',
      description: '存在分歧意见，需要进一步评估风险。',
      context: council.disagreements[0].topic,
      decisionPrompt: '你倾向于哪一方的意见？',
      options: council.disagreements[0].positions.slice(0, 2).map((pos, index) => ({
        id: `opt-2-${index}`,
        label: pos.stance.substring(0, 30),
        consequence: `${pos.role} 的立场`,
        riskLevel: index === 0 ? 'medium' : 'low',
      })),
      correctOptionId: 'opt-2-0',
      consequence: {
        correct: '选择了较为安全的立场。',
        incorrect: '该立场可能存在一定风险。',
        feedback: '需要综合考虑各方意见。',
      },
      scoring: {
        maxPoints: 100,
        rubric: '基于风险评估标准',
        weight: 0.8,
      },
    });
  }

  // Phase 3: Evidence gap resolution if there are gaps
  if (council.evidenceGaps.length > 0 && phases.length < maxPhases) {
    phases.push({
      id: 'phase-3',
      title: '证据补充',
      description: '发现证据缺口，需要补充信息。',
      context: council.evidenceGaps[0].description,
      decisionPrompt: '你应该如何补充证据？',
      options: [
        {
          id: 'opt-3a',
          label: '通过内部系统核验',
          consequence: '使用可信渠道获取证据',
          riskLevel: 'low',
        },
        {
          id: 'opt-3b',
          label: '依赖现有信息',
          consequence: '可能存在证据不足的风险',
          riskLevel: 'high',
        },
      ],
      correctOptionId: 'opt-3a',
      consequence: {
        correct: '正确！通过可信渠道补充证据是最佳实践。',
        incorrect: '危险！证据不足可能导致错误决策。',
        feedback: council.evidenceGaps[0].description,
      },
      scoring: {
        maxPoints: 100,
        rubric: '基于证据完整性评分',
        weight: 0.9,
      },
    });
  }

  // Fallback to fixed phishing scenario if no phases generated
  if (phases.length === 0) {
    return createFallbackScenario();
  }

  return phases.slice(0, maxPhases);
}

function createFallbackScenario(): ScenarioPhase[] {
  return [
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
  ];
}

function extractTags(content: string): string[] {
  const keywords = ['钓鱼', '邮件', '密码', '重置', '紧急', '账户', '安全', '上报'];
  const tags: string[] = [];

  for (const keyword of keywords) {
    if (content.includes(keyword)) {
      tags.push(keyword);
    }
  }

  return tags.slice(0, 5);
}
