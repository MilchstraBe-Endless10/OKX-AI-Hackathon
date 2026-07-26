// @sopscape/core — LLM provider with retry chain, fallback, and Zod validation
// ponytail: primary model → same-model retry → fallback model (separate baseUrl to avoid shared rate limit).
// 30s timeout per call, 1 retry, Zod schema validation at every step.
// Sequential specialists: avoids burst QPS triggering rate limits.

import {
  FindingSchema,
  CouncilResultSchema,
  type Finding,
  type CouncilResult,
} from '@sopscape/contracts';
import type { AttemptBudget } from './attempt-budget.js';

const ROLES = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;
type Role = (typeof ROLES)[number];

const CALL_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

const ROLE_PROMPTS: Record<Role, string> = {
  'procedure-analyst': 'You are a procedure analyst. Analyze the SOP and provide a finding.',
  'risk-challenger': 'You are a risk challenger. Identify risks in the SOP and provide a finding.',
  'evidence-auditor':
    'You are an evidence auditor. Identify evidence gaps in the SOP and provide a finding.',
};

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackModel?: string; // e.g. 'glm-4.6' — used on primary failure
  fallbackBaseUrl?: string; // separate provider URL for fallback (avoids shared rate limit)
  timeoutMs?: number;
}

/** Parse and validate a finding with Zod — returns null if invalid */
export function parseFinding(raw: unknown): Finding | null {
  const result = FindingSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Parse and validate an agent role with Zod — returns null if invalid */
export function parseAgentRole(raw: unknown): string | null {
  const validRoles = [
    'procedure-analyst',
    'risk-challenger',
    'evidence-auditor',
    'moderator',
  ] as const;
  if (typeof raw !== 'string' || !validRoles.includes(raw as (typeof validRoles)[number]))
    return null;
  return raw;
}

/** Parse and validate a council result with Zod — returns null if invalid */
function parseCouncil(raw: unknown): CouncilResult | null {
  const result = CouncilResultSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export class LLMProvider {
  constructor(private config: LLMConfig) {}

  /**
   * Run all 3 specialists in parallel. Returns { successes, failures }.
   * Each specialist gets its own retry chain with fallback.
   */
  async runSpecialists(
    input: { title: string; content: string; locale?: string },
    _budget: AttemptBudget,
    signal?: AbortSignal,
  ): Promise<{
    successes: { role: Role; finding: Finding }[];
    failures: { role: Role; error: string }[];
  }> {
    return this.runSpecialistsForRoles(ROLES, input, signal);
  }

  /**
   * Run specialists for specific roles only — used for selective retry.
   * Returns { successes, failures }.
   */
  async runSpecialistsForRoles(
    roles: readonly Role[],
    input: { title: string; content: string; locale?: string },
    signal?: AbortSignal,
  ): Promise<{
    successes: { role: Role; finding: Finding }[];
    failures: { role: Role; error: string }[];
  }> {
    // Sequential: avoids burst QPS triggering rate limits
    const results: Array<{ role: Role; finding?: Finding; error?: string }> = [];
    for (const role of roles) {
      if (signal?.aborted) break;
      const finding = await this.callWithRoleValidation(
        this.buildSpecialistPrompt(role, input),
        signal,
      );
      if (finding) {
        results.push({ role, finding });
      } else {
        results.push({ role, error: 'SCHEMA_OR_CALL_FAILED' });
      }
    }

    const successes: { role: Role; finding: Finding }[] = [];
    const failures: { role: Role; error: string }[] = [];
    for (const r of results) {
      if ('finding' in r && r.finding) {
        successes.push({ role: r.role, finding: r.finding });
      } else {
        failures.push({ role: r.role, error: r.error ?? 'UNKNOWN' });
      }
    }
    return { successes, failures };
  }

  /**
   * Run moderator to synthesize specialist findings.
   * Returns null if validation fails after retry chain.
   */
  async runModerator(
    findings: Record<Role, Finding>,
    _budget: AttemptBudget,
    signal?: AbortSignal,
  ): Promise<CouncilResult | null> {
    const prompt = this.buildModeratorPrompt(findings);
    return this.callWithCouncilValidation(prompt, signal);
  }

  /**
   * Call with retry AND schema validation — triggers fallback on last retry.
   * Primary model → retry primary → fallback model.
   */
  private async callWithRoleValidation(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Finding | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) return null;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const raw = await this.safeCallOneAttempt(prompt, this.config.model, signal);
      const finding = parseFinding(raw);
      if (finding) return finding;
      // Schema invalid — try fallback on last retry
      if (attempt === MAX_RETRIES && this.config.fallbackModel) {
        const fallbackRaw = await this.safeCallOneAttempt(
          prompt,
          this.config.fallbackModel,
          signal,
          true,
        );
        const fallbackFinding = parseFinding(fallbackRaw);
        if (fallbackFinding) return fallbackFinding;
      }
    }
    return null;
  }

  /**
   * Call with retry AND council schema validation — triggers fallback on last retry.
   */
  private async callWithCouncilValidation(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<CouncilResult | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) return null;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const raw = await this.safeCallOneAttempt(prompt, this.config.model, signal);
      const validated = parseCouncil(raw);
      if (validated) return validated;
      // Schema invalid — try fallback on last retry
      if (attempt === MAX_RETRIES && this.config.fallbackModel) {
        const fallbackRaw = await this.safeCallOneAttempt(
          prompt,
          this.config.fallbackModel,
          signal,
          true,
        );
        const fallbackValidated = parseCouncil(fallbackRaw);
        if (fallbackValidated) return fallbackValidated;
      }
    }
    return null;
  }

  private async callOneAttempt(
    prompt: string,
    modelName: string,
    signal?: AbortSignal,
    useFallback?: boolean,
  ): Promise<unknown> {
    const timeoutMs = this.config.timeoutMs ?? CALL_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });

    const url =
      useFallback && this.config.fallbackBaseUrl
        ? this.config.fallbackBaseUrl
        : this.config.baseUrl;
    const isAnthropic = url.includes('anthropic');
    const endpoint = isAnthropic ? `${url}/v1/messages` : `${url}/chat/completions`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const body: Record<string, unknown> = isAnthropic
      ? {
          model: modelName,
          max_tokens: 2000,
          messages: [{ role: 'user', content: `Respond with JSON only.\n\n${prompt}` }],
        }
      : {
          model: modelName,
          messages: [
            { role: 'system', content: 'Respond with JSON only.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2000,
        };

    if (isAnthropic) {
      headers['x-api-key'] = this.config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      // Extract content
      let content: string;
      if (isAnthropic) {
        const contentArr = data.content as Array<Record<string, unknown>> | undefined;
        content = contentArr?.[0]?.text as string;
      } else {
        const choices = data.choices as Array<Record<string, unknown>> | undefined;
        const message = choices?.[0]?.message as Record<string, unknown> | undefined;
        content = message?.content as string;
      }

      if (typeof content !== 'string' || !content) return null;

      // Strip markdown code fences
      const cleaned = content
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();

      return JSON.parse(cleaned) as Record<string, unknown>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async safeCallOneAttempt(
    prompt: string,
    modelName: string,
    signal?: AbortSignal,
    useFallback?: boolean,
  ): Promise<unknown> {
    try {
      return await this.callOneAttempt(prompt, modelName, signal, useFallback);
    } catch {
      return null;
    }
  }

  private buildSpecialistPrompt(
    role: Role,
    input: { title: string; content: string; locale?: string },
  ): string {
    return `${ROLE_PROMPTS[role]}

SOP Title: ${input.title}
SOP Content: ${input.content}${input.locale ? `\nLocale: ${input.locale}` : ''}

Return exactly one JSON object and no markdown. The object must contain every field below:
{
  "role": "${role}",
  "claim": "a specific claim grounded in this SOP",
  "evidenceRefs": ["quoted step or evidence reference"],
  "confidence": 0.8,
  "severity": "low",
  "affectedStepIds": ["step-1"],
  "unsupported": false
}
Use only these severity values: low, medium, high, critical. Keep arrays valid even when evidence is missing; use [] and set unsupported to true. Do not add fields.`;
  }

  private buildModeratorPrompt(findings: Record<Role, Finding>): string {
    const findingsText = Object.values(findings)
      .map((f) => `- ${f.role}: ${f.claim} (confidence: ${f.confidence}, severity: ${f.severity})`)
      .join('\n');
    return `You are a moderator synthesizing expert findings.

Findings:
${findingsText}

Return exactly one JSON object and no markdown with this shape:
{
  "consensus": [{
    "role": "procedure-analyst",
    "claim": "specific consensus claim",
    "evidenceRefs": ["finding evidence"],
    "confidence": 0.8,
    "severity": "medium",
    "affectedStepIds": ["step-1"],
    "unsupported": false
  }],
  "disagreements": [{"topic": "topic", "positions": [{"role": "procedure-analyst", "stance": "position"}, {"role": "risk-challenger", "stance": "position"}]}],
  "evidenceGaps": [{"description": "missing evidence", "refs": ["step-1"]}],
  "recommendedPath": ["step-1"],
  "decisionNodes": [{"id": "decision-1", "prompt": "What should happen next?", "options": [{"id": "option-1", "label": "Verify", "consequence": "Evidence is preserved"}]}]
}
Use only valid roles and severity values. Arrays may be empty except consensus, which must contain at least one finding. Do not add fields.`;
  }
}
