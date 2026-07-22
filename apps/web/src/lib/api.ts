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
