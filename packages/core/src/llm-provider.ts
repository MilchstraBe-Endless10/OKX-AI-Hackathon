// @sopscape/core — real LLM provider with retry and timeout
// ponytail: minimal wrapper around OKX.AI compatible API.
// 30s timeout per call, exponential backoff retry, no new deps.

import {
  type AgentRole,
  type Finding,
  type CouncilResult,
  AgentRoleSchema,
  FindingSchema,
  CouncilResultSchema,
} from '@sopscape/contracts';

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

const CALL_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1; // one retry per call site

export class LLMProvider {
  constructor(private config: LLMConfig) {}

  async runSpecialists(
    input: { title: string; content: string; locale?: string },
    signal?: AbortSignal,
  ): Promise<{
    successes: { role: AgentRole; finding: Finding }[];
    failures: { role: AgentRole; error: string }[];
  }> {
    const roles: AgentRole[] = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'];
    const results = await Promise.all(
      roles.map(async (role) => {
        const finding = await this.callWithRetry(
          'specialist',
          role,
          this.buildSpecialistPrompt(role, input),
          signal,
        );
        return { role, finding };
      }),
    );

    const successes: { role: AgentRole; finding: Finding }[] = [];
    const failures: { role: AgentRole; error: string }[] = [];
    for (const r of results) {
      if (r.finding) {
        successes.push({ role: r.role, finding: r.finding });
      } else {
        failures.push({ role: r.role, error: 'PROVIDER_FAILURE' });
      }
    }
    return { successes, failures };
  }

  async runModerator(findings: Finding[], signal?: AbortSignal): Promise<CouncilResult | null> {
    const prompt = this.buildModeratorPrompt(findings);
    const raw = await this.callWithRetry('moderator', 'moderator', prompt, signal);
    if (!raw) return null;

    const validated = CouncilResultSchema.safeParse(raw);
    return validated.success ? validated.data : null;
  }

  private async callWithRetry(
    attemptType: 'specialist' | 'moderator',
    role: AgentRole | string,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) return null;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      try {
        const result = await this.callOnce(prompt, signal);
        if (result) return result;
      } catch {
        // retry on next iteration
      }
    }
    return null;
  }

  private async callOnce(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | null> {
    const controller = new AbortController();
    const combined = new AbortController();

    const timeout = setTimeout(() => combined.abort(), CALL_TIMEOUT_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      combined.abort();
    });

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a SOP analysis assistant. Respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: combined.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private buildSpecialistPrompt(
    role: AgentRole,
    input: { title: string; content: string; locale?: string },
  ): string {
    return JSON.stringify({
      role,
      task: 'Analyze the following SOP and provide findings',
      title: input.title,
      content: input.content,
      locale: input.locale ?? 'zh-CN',
      output_format: {
        role,
        claim: 'string - your main finding',
        evidence_refs: ['string - step IDs referenced'],
        confidence: 'number 0-1',
        severity: 'low|medium|high|critical',
        affected_step_ids: ['string'],
        unsupported: 'boolean',
      },
    });
  }

  private buildModeratorPrompt(findings: Finding[]): string {
    return JSON.stringify({
      task: 'Synthesize specialist findings into a council result',
      findings,
      output_format: {
        consensus: 'array of Finding objects all specialists agree on',
        disagreements: 'array of topics where specialists disagree with positions',
        evidence_gaps: 'array of missing evidence descriptions and refs',
        recommended_path: 'array of action strings',
        decision_nodes: 'array of decision points with options',
      },
    });
  }
}

/** Parse agent role from LLM response safely */
export function parseAgentRole(raw: unknown): AgentRole | null {
  const result = AgentRoleSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Parse finding from LLM response safely */
export function parseFinding(raw: unknown): Finding | null {
  const result = FindingSchema.safeParse(raw);
  return result.success ? result.data : null;
}
