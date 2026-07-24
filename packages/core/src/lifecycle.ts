// @sopscape/core — lifecycle state machine and decision evaluation

export type LifecycleState =
  | 'QUEUED'
  | 'COMPRESSING'
  | 'SPECIALISTS_RUNNING'
  | 'MODERATING'
  | 'PERSISTING'
  | 'READY'
  | 'FAILED'
  | 'PARTIAL_FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  QUEUED: ['COMPRESSING', 'SPECIALISTS_RUNNING', 'FAILED', 'CANCELLED'],
  COMPRESSING: ['SPECIALISTS_RUNNING', 'FAILED', 'CANCELLED'],
  SPECIALISTS_RUNNING: ['MODERATING', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED'],
  MODERATING: ['PERSISTING', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED'],
  PERSISTING: ['READY', 'FAILED', 'CANCELLED'],
  READY: ['EXPIRED'],
  FAILED: ['EXPIRED'],
  PARTIAL_FAILED: ['EXPIRED'],
  CANCELLED: ['EXPIRED'],
  EXPIRED: [],
};

/**
 * Check if a state transition is legal.
 * For SPECIALISTS_RUNNING → MODERATING, requires all 3 specialist results.
 */
export function isValidTransition(
  from: LifecycleState,
  to: LifecycleState,
  specialistCount?: number,
): boolean {
  if (from === 'SPECIALISTS_RUNNING' && to === 'MODERATING' && specialistCount !== undefined) {
    return specialistCount >= 3;
  }
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export interface VersionedState {
  id: string;
  version: number;
  status: LifecycleState;
}

export interface DecisionSuccess {
  version: number;
}

export interface DecisionConflict {
  error: 'VERSION_CONFLICT';
  currentVersion: number;
}

/**
 * Apply a decision with optimistic concurrency control.
 * Returns VERSION_CONFLICT when expectedVersion doesn't match current version.
 */
export function applyDecision(
  state: VersionedState,
  expectedVersion: number,
  _nodeId: string,
  _choiceId: string,
): DecisionSuccess | DecisionConflict {
  if (expectedVersion !== state.version) {
    return { error: 'VERSION_CONFLICT', currentVersion: state.version };
  }
  return { version: state.version + 1 };
}
