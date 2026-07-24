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
        // callWithRetry validates with parseFinding — triggers fallback on schema failure
        const raw = await this.callWithRoleValidation(
          this.buildSpecialistPrompt(role, input),
          signal,
        );
        return { role, finding: raw };
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

  /** Call with retry AND schema validation — triggers fallback on invalid structure */
  private async callWithRoleValidation(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Finding | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) return null;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const raw = await this.callOneAttempt(prompt, this.config.modelName, signal);
      const finding = parseFinding(raw);
      if (finding) return finding;
      // Schema invalid — try fallback on last retry
      if (attempt === MAX_RETRIES && this.config.fallbackName) {
        const fallbackRaw = await this.callOneAttempt(prompt, this.config.fallbackName, signal);
        const fallbackFinding = parseFinding(fallbackRaw);
        if (fallbackFinding) return fallbackFinding;
      }
    }
    return null;
  }

  async runModerator(findings: Finding[], signal?: AbortSignal): Promise<CouncilResult | null> {
    const prompt = this.buildModeratorPrompt(findings);
    const raw = await this.callWithCouncilValidation(prompt, signal);
    return raw;
  }

  /** Call with retry AND council schema validation — triggers fallback on invalid structure */
  private async callWithCouncilValidation(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<CouncilResult | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) return null;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const raw = await this.callOneAttempt(prompt, this.config.modelName, signal);
      const validated = CouncilResultSchema.safeParse(raw);
      if (validated.success) return validated.data;
      // Schema invalid — try fallback on last retry
      if (attempt === MAX_RETRIES && this.config.fallbackName) {
        const fallbackRaw = await this.callOneAttempt(prompt, this.config.fallbackName, signal);
        const fallbackValidated = CouncilResultSchema.safeParse(fallbackRaw);
        if (fallbackValidated.success) return fallbackValidated.data;
      }
    }
    return null;
  }

  private async callOneAttempt(
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
