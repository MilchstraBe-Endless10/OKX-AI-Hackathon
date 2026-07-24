// @sopscape/core — real LLM provider with retry, timeout, and fallback
// ponytail: minimal wrapper around OKX.AI compatible API.
// 30s timeout per call, 1 retry, fallback to glm-4.6 if configured.

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
  fallbackName?: string; // e.g. 'glm-4.6' — used on primary failure
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
    return this.runSpecialistsForRoles(roles, input, signal);
  }

  async runSpecialistsForRoles(
    roles: readonly AgentRole[],
    input: { title: string; content: string; locale?: string },
    signal?: AbortSignal,
  ): Promise<{
    successes: { role: AgentRole; finding: Finding }[];
    failures: { role: AgentRole; error: string }[];
  }> {
    const results = await Promise.all(
      roles.map(async (role) => {
        const raw = await this.callWithRetry(this.buildSpecialistPrompt(role, input), signal);
        // Runtime schema validation — null if invalid
        const finding = parseFinding(raw);
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
    const raw = await this.callWithRetry(prompt, signal);
    if (!raw) return null;

    const validated = CouncilResultSchema.safeParse(raw);
    return validated.success ? validated.data : null;
  }

  private async callWithRetry(prompt: string, signal?: AbortSignal): Promise<unknown> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) return null;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      try {
        const result = await this.callOnce(prompt, this.config.modelName, signal);
        if (result) return result;
      } catch {
        // Exception during primary call — try fallback on last retry
        if (attempt === MAX_RETRIES && this.config.fallbackName) {
          try {
            const fallback = await this.callOnce(prompt, this.config.fallbackName, signal);
            if (fallback) return fallback;
          } catch {
            // fallback also failed
          }
        }
      }
    }

    // All retries exhausted and primary returned null/invalid — try fallback once
    if (this.config.fallbackName) {
      try {
        const fallback = await this.callOnce(prompt, this.config.fallbackName, signal);
        if (fallback) return fallback;
      } catch {
        // fallback also failed
      }
    }
    return null;
  }

  private async callOnce(
    prompt: string,
    modelName: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      controller.abort();
    });

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
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
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
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

/** Parse finding from LLM response safely — returns null if invalid */
export function parseFinding(raw: unknown): Finding | null {
  const result = FindingSchema.safeParse(raw);
  return result.success ? result.data : null;
}
