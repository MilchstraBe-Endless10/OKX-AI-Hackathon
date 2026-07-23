// @sopscape/core — LLM provider interface for real model calls
// ponytail: minimal provider — OKX.AI compatible, no retry, no streaming.

import {
  type AgentRole,
  type Disagreement,
  type EvidenceGap,
  type Finding,
  type DecisionNode,
} from '@sopscape/contracts';
import { AttemptBudget } from './attempt-budget.js';

const ROLES = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;
type Role = (typeof ROLES)[number];

const VALID_AGENT_ROLES: AgentRole[] = [
  'procedure-analyst',
  'risk-challenger',
  'evidence-auditor',
  'moderator',
];

function parseAgentRole(raw: string): AgentRole {
  return VALID_AGENT_ROLES.includes(raw as AgentRole) ? (raw as AgentRole) : 'moderator';
}

const ROLE_PROMPTS: Record<Role, string> = {
  'procedure-analyst':
    'You are a procedure analyst. Analyze the SOP and provide a finding with role, claim, evidence_refs, confidence (0-1), severity (low/medium/high), affected_step_ids, and unsupported (boolean).',
  'risk-challenger':
    'You are a risk challenger. Identify risks in the SOP and provide a finding with role, claim, evidence_refs, confidence (0-1), severity (low/medium/high), affected_step_ids, and unsupported (boolean).',
  'evidence-auditor':
    'You are an evidence auditor. Identify evidence gaps in the SOP and provide a finding with role, claim, evidence_refs, confidence (0-1), severity (low/medium/high), affected_step_ids, and unsupported (boolean).',
};

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

interface ModeratorResponse {
  consensus: Finding[];
  disagreements: Disagreement[];
  evidenceGaps: EvidenceGap[];
  recommendedPath: string[];
  decisionNodes: DecisionNode[];
}

export class LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Run all 3 specialists in parallel with budget tracking.
   */
  async runSpecialists(
    input: { title: string; content: string; locale?: string },
    budget: AttemptBudget,
    signal?: AbortSignal,
  ): Promise<Record<Role, Finding>> {
    const results = await Promise.all(
      ROLES.map(async (role) => {
        budget.startAttempt(role);
        const finding = await this.callModel(role, input, signal);
        return [role, finding] as const;
      }),
    );
    return Object.fromEntries(results) as Record<Role, Finding>;
  }

  /**
   * Run moderator to synthesize specialist findings.
   */
  async runModerator(
    findings: Record<Role, Finding>,
    budget: AttemptBudget,
    signal?: AbortSignal,
  ): Promise<ModeratorResponse> {
    budget.startAttempt('moderator');
    const prompt = this.buildModeratorPrompt(findings);
    const response = await this.callModelJson('moderator', prompt, signal);

    const consensus: Finding[] = Array.isArray(response.consensus)
      ? response.consensus.map((f: Record<string, unknown>) => this.parseFinding(f))
      : Object.values(findings);

    const disagreements: Disagreement[] = Array.isArray(response.disagreements)
      ? response.disagreements.map((d: Record<string, unknown>) => ({
          topic: String(d.topic ?? ''),
          positions: Array.isArray(d.positions)
            ? d.positions.map((p: Record<string, unknown>) => ({
                role: parseAgentRole(String(p.role ?? 'moderator')),
                stance: String(p.stance ?? ''),
              }))
            : [],
        }))
      : [];

    const evidenceGaps: EvidenceGap[] = Array.isArray(response.evidenceGaps)
      ? response.evidenceGaps.map((g: Record<string, unknown>) => ({
          description: String(g.description ?? ''),
          refs: Array.isArray(g.refs) ? g.refs.map(String) : [],
        }))
      : [];

    const recommendedPath: string[] = Array.isArray(response.recommendedPath)
      ? response.recommendedPath.map(String)
      : ['verify', 'report'];

    const decisionNodes: DecisionNode[] = Array.isArray(response.decisionNodes)
      ? response.decisionNodes.map((n: Record<string, unknown>) => ({
          id: String(n.id ?? ''),
          prompt: String(n.prompt ?? ''),
          options: Array.isArray(n.options)
            ? n.options.map((o: Record<string, unknown>) => ({
                id: String(o.id ?? ''),
                label: String(o.label ?? ''),
                consequence: String(o.consequence ?? ''),
              }))
            : [],
        }))
      : [];

    return { consensus, disagreements, evidenceGaps, recommendedPath, decisionNodes };
  }

  private async callModel(
    role: Role,
    input: { title: string; content: string; locale?: string },
    signal?: AbortSignal,
  ): Promise<Finding> {
    const prompt = `${ROLE_PROMPTS[role]}\n\nSOP Title: ${input.title}\nSOP Content: ${input.content}${input.locale ? `\nLocale: ${input.locale}` : ''}`;
    const response = await this.callModelJson(role, prompt, signal);
    return this.parseFinding(response, role);
  }

  private parseFinding(raw: Record<string, unknown>, fallbackRole?: string): Finding {
    const severity = String(raw.severity ?? 'medium');
    return {
      role: (fallbackRole ?? String(raw.role ?? 'moderator')) as Finding['role'],
      claim: String(raw.claim ?? 'No claim provided'),
      evidenceRefs: Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs.map(String) : [],
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
      severity:
        severity === 'low' ||
        severity === 'medium' ||
        severity === 'high' ||
        severity === 'critical'
          ? severity
          : 'medium',
      affectedStepIds: Array.isArray(raw.affectedStepIds) ? raw.affectedStepIds.map(String) : [],
      unsupported: typeof raw.unsupported === 'boolean' ? raw.unsupported : false,
    };
  }

  private async callModelJson(
    _label: string,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const { apiKey, baseUrl, model, timeoutMs = 30_000 } = this.config;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });

    // ponytail: detect Anthropic format by URL
    const isAnthropic = baseUrl.includes('anthropic');

    try {
      const url = isAnthropic ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const body: Record<string, unknown> = isAnthropic
        ? {
            model,
            max_tokens: 2000,
            messages: [{ role: 'user', content: `Respond with JSON only.\n\n${prompt}` }],
          }
        : {
            model,
            messages: [
              { role: 'system', content: 'Respond with JSON only.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 2000,
          };

      if (isAnthropic) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Model API error: ${response.status} ${response.statusText}`);
      }

      const data: Record<string, unknown> = (await response.json()) as Record<string, unknown>;

      // Extract content based on format
      let content: string;
      if (isAnthropic) {
        // Anthropic: content[0].text
        const contentArr = data.content as Array<Record<string, unknown>> | undefined;
        content = contentArr?.[0]?.text as string;
      } else {
        // OpenAI: choices[0].message.content
        const choices = (data.choices as Array<Record<string, unknown>> | undefined)?.[0];
        const message = choices?.message as Record<string, unknown> | undefined;
        content = message?.content as string;
      }

      if (typeof content !== 'string' || !content) throw new Error('Empty model response');

      const parsed: Record<string, unknown> = JSON.parse(content) as Record<string, unknown>;
      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildModeratorPrompt(findings: Record<Role, Finding>): string {
    const findingsText = Object.values(findings)
      .map((f) => `- ${f.role}: ${f.claim} (confidence: ${f.confidence}, severity: ${f.severity})`)
      .join('\n');

    return `You are a moderator synthesizing expert findings.\n\nFindings:\n${findingsText}\n\nReturn a JSON object with: consensus (array of findings), disagreements (array with topic and positions), evidenceGaps (array with description and refs), recommendedPath (array of action strings), decisionNodes (array with id, prompt, options).`;
  }
}
