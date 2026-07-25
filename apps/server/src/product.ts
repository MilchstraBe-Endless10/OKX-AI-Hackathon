import type {
  CouncilResult,
  DecisionEvaluation,
  DecisionNode,
  ReadinessVerdict,
  VersionComparison,
} from '@sopscape/contracts';

export interface ReadinessAssessment {
  verdict: ReadinessVerdict;
  score: number;
  evidenceCoverage: number;
  blockers: string[];
  warnings: string[];
  evidenceRefs: string[];
}

export function ensurePhishingScenario(council: CouncilResult): CouncilResult {
  return {
    ...council,
    decisionNodes: [
      {
        id: 'phishing-sender',
        prompt: '邮件声称来自管理层并要求紧急操作，第一步应该做什么？',
        options: [
          {
            id: 'trust-display-name',
            label: '相信显示名称并继续',
            consequence: '攻击者可伪造显示名称，身份尚未核验。',
          },
          {
            id: 'verify-sender',
            label: '通过公司通讯录独立核验',
            consequence: '绕开邮件内联系方式，确认真实发件人。',
          },
        ],
      },
      {
        id: 'phishing-link',
        prompt: '邮件要求通过链接重置密码，应该如何处理？',
        options: [
          {
            id: 'open-email-link',
            label: '点击邮件内链接并登录',
            consequence: '凭证可能被钓鱼站点窃取并用于账户接管。',
          },
          {
            id: 'avoid-link',
            label: '不点击链接，直接访问官方入口',
            consequence: '阻断恶意跳转，并保留原始邮件作为证据。',
          },
        ],
      },
      {
        id: 'phishing-report',
        prompt: '确认邮件可疑后，最后一步是什么？',
        options: [
          {
            id: 'delete-only',
            label: '直接删除，不做记录',
            consequence: '团队无法封禁同源攻击，其他成员仍可能受害。',
          },
          {
            id: 'report-email',
            label: '保留证据、隔离并上报安全团队',
            consequence: '安全团队可追踪指标、封禁来源并通知其他成员。',
          },
        ],
      },
    ],
  };
}

const SAFE_TERMS = ['核验', '上报', '隔离', '不点击', '保留证据', 'verify', 'report', 'isolate'];
const RISK_TERMS = ['点击', '输入密码', '绕过', '忽略', '直接执行', 'click', 'password', 'bypass'];

function containsAny(value: string, terms: readonly string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function computeReadiness(council: CouncilResult, content: string): ReadinessAssessment {
  const evidenceRefs = [...new Set(council.consensus.flatMap((finding) => finding.evidenceRefs))];
  const critical = council.consensus.filter((finding) => finding.severity === 'critical');
  const high = council.consensus.filter((finding) => finding.severity === 'high');
  const unsupported = council.consensus.filter((finding) => finding.unsupported);
  const evidenceCoverage =
    council.consensus.length === 0
      ? 0
      : council.consensus.filter(
          (finding) => finding.evidenceRefs.length > 0 && !finding.unsupported,
        ).length / council.consensus.length;
  const blockers = [
    ...critical.map((finding) => `关键风险：${finding.claim}`),
    ...unsupported.map((finding) => `缺少证据：${finding.claim}`),
  ];
  const warnings = [
    ...high.map((finding) => `高风险：${finding.claim}`),
    ...council.evidenceGaps.map((gap) => `证据缺口：${gap.description}`),
  ];

  let score = 100;
  score -= critical.length * 45;
  score -= high.length * 20;
  score -= unsupported.length * 20;
  score -= council.evidenceGaps.length * 12;
  score -= council.disagreements.length * 6;
  if (!containsAny(content, SAFE_TERMS)) score -= 15;
  score = Math.max(0, Math.min(100, Math.round(score * (0.7 + evidenceCoverage * 0.3))));

  const verdict: ReadinessVerdict =
    blockers.length > 0 || score < 60
      ? 'BLOCK'
      : warnings.length > 0 || score < 85
        ? 'WARN'
        : 'READY';

  return { verdict, score, evidenceCoverage, blockers, warnings, evidenceRefs };
}

export function evaluateDecision(node: DecisionNode, choiceId: string): DecisionEvaluation {
  const optionIndex = node.options.findIndex((candidate) => candidate.id === choiceId);
  const option = node.options[optionIndex];
  if (!option) throw new Error('DECISION_NOT_FOUND');
  const combined = `${option.label} ${option.consequence}`;
  const risky = containsAny(combined, RISK_TERMS) || (node.options.length > 1 && optionIndex === 0);
  const safe = containsAny(combined, SAFE_TERMS) || (node.options.length > 1 && optionIndex > 0);
  const scoreDelta = risky ? -35 : safe ? 25 : 5;
  const riskLevel = risky ? 'critical' : safe ? 'low' : 'medium';
  return {
    nodeId: node.id,
    choiceId,
    scoreDelta,
    riskLevel,
    consequence: option.consequence,
    coaching: risky
      ? '停止操作，保留证据，并通过独立渠道核验与上报。'
      : safe
        ? '决策符合安全处置原则：核验、隔离、上报并保留证据。'
        : '该选择可继续，但应补充核验依据和升级路径。',
  };
}

export function compareSopVersions(
  previous: string,
  current: string,
  previousRisk: Pick<ReadinessAssessment, 'score' | 'verdict'>,
  currentRisk: Pick<ReadinessAssessment, 'score' | 'verdict'>,
): VersionComparison {
  const previousLines = new Set(
    previous
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const currentLines = new Set(
    current
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const addedLines = [...currentLines].filter((line) => !previousLines.has(line));
  const removedLines = [...previousLines].filter((line) => !currentLines.has(line));
  const riskDelta = currentRisk.score - previousRisk.score;
  const changedLines = addedLines.length + removedLines.length;
  return {
    changedLines,
    addedLines,
    removedLines,
    riskDelta,
    regressed:
      riskDelta < 0 || (previousRisk.verdict !== 'BLOCK' && currentRisk.verdict === 'BLOCK'),
    summary:
      changedLines === 0
        ? '内容未发生可见变化。'
        : riskDelta < 0
          ? `版本发生 ${changedLines} 处变化，就绪分下降 ${Math.abs(riskDelta)} 分。`
          : `版本发生 ${changedLines} 处变化，就绪分提升 ${riskDelta} 分。`,
  };
}
