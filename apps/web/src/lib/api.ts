/**
 * UI presentation mapping of the server state machine.
 *
 * This is NOT a copy of domain contract types. The server exposes
 * Rehearsal.status as a string; this enum gives the UI type-safe
 * phase names for rendering progress, badges, and phase-reactive
 * 3D behavior. It mirrors the PRD state machine for presentation only:
 *
 *   QUEUED -> COMPRESSING? -> SPECIALISTS_RUNNING -> MODERATING -> PERSISTING -> READY
 *      |          |                   |                  |            |
 *      +----------+-------------------+------------------+------------+-> FAILED/CANCELLED
 *   READY|FAILED|CANCELLED -> EXPIRED
 */
export type GenerationPhase =
  | 'QUEUED'
  | 'COMPRESSING'
  | 'SPECIALISTS_RUNNING'
  | 'MODERATING'
  | 'PERSISTING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type UIPhase = GenerationPhase | 'idle';

/** Map server status string → UI phase. Single source of truth. */
export function statusToPhase(status: string): GenerationPhase {
  const upper = status.toUpperCase();
  switch (upper) {
    case 'QUEUED':
      return 'QUEUED';
    case 'COMPRESSING':
      return 'COMPRESSING';
    case 'SPECIALISTS_RUNNING':
      return 'SPECIALISTS_RUNNING';
    case 'MODERATING':
      return 'MODERATING';
    case 'PERSISTING':
      return 'PERSISTING';
    case 'READY':
      return 'READY';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return 'QUEUED';
  }
}

export const PHASE_ORDER: GenerationPhase[] = [
  'QUEUED',
  'COMPRESSING',
  'SPECIALISTS_RUNNING',
  'MODERATING',
  'PERSISTING',
  'READY',
];

export interface A2mcpResponse {
  rehearsalId: string;
  status: 'READY';
  council: CouncilResult;
  passport?: SopPassport;
  sop?: SopRecord;
}

export async function generateRehearsal(
  input: SopInput,
  request: typeof fetch = fetch,
): Promise<A2mcpResponse> {
  const response = await request('/api/generate-rehearsal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `A2MCP request failed (${response.status})`;
    throw new Error(message);
  }
  if (!body || typeof body !== 'object') throw new Error('Invalid A2MCP response');

  const { rehearsalId, status, passport, sop, ...councilData } = body as Record<string, unknown>;
  const council = CouncilResultSchema.safeParse(councilData);
  if (typeof rehearsalId !== 'string' || status !== 'READY' || !council.success) {
    throw new Error('Invalid A2MCP response');
  }

  return {
    rehearsalId,
    status,
    council: council.data,
    passport: passport as SopPassport | undefined,
    sop: sop as SopRecord | undefined,
  };
}

export function councilToScene(council: CouncilResult): Scene {
  const agents = new Map(
    council.consensus
      .filter((finding) => finding.role !== 'moderator')
      .map((finding) => [
        finding.role,
        { id: finding.role, confidence: finding.confidence, status: 'complete' as const },
      ]),
  );
  const evidence = new Map<string, string>();
  council.consensus.forEach((finding) =>
    finding.evidenceRefs.forEach((ref) => evidence.set(ref, finding.claim)),
  );
  council.evidenceGaps.forEach((gap) =>
    gap.refs.forEach((ref) => evidence.set(ref, gap.description)),
  );

  return SceneSchema.parse({
    schemaVersion: '1.0.0',
    agentStates: [...agents.values()],
    evidenceNodes: [...evidence].slice(0, 100).map(([ref, label], index) => ({
      id: `evidence-${index + 1}`,
      ref,
      label,
    })),
    riskPaths: council.disagreements.slice(0, 50).map((item, index) => ({
      id: `risk-${index + 1}`,
      from: item.positions[0]?.role ?? 'moderator',
      to: item.positions[1]?.role ?? 'moderator',
      severity: 'high',
    })),
    decisionNodes: council.decisionNodes.map((node) => ({ id: node.id, label: node.prompt })),
    cameraCues: ['agent-arrival', 'consensus-reveal', 'evidence-node-show', 'decision-focus'],
    paletteToken: 'neutral',
  });
}
import {
  CouncilResultSchema,
  SceneSchema,
  type CouncilResult,
  type Scene,
  type SopPassport,
  type SopRecord,
  type SopInput,
} from '@sopscape/contracts';
