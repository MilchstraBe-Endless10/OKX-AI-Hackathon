import { GenerationPhase } from '../lib/api';

const EXPERT_ROLES: { role: string; label: string }[] = [
  { role: 'procedure-analyst', label: 'Procedure Analyst' },
  { role: 'risk-challenger', label: 'Risk Challenger' },
  { role: 'evidence-auditor', label: 'Evidence Auditor' },
];

interface ProgressPanelProps {
  phase: GenerationPhase;
  rehearsalId: string | null;
}

export default function ProgressPanel({ phase, rehearsalId }: ProgressPanelProps) {
  return (
    <div className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-4">
      <h2 className="text-base font-semibold text-slate-100">Analysis Progress</h2>

      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <PhaseDot phase={phase} />
        <span className="text-sm text-slate-300" data-testid="current-phase">
          {phaseLabel(phase)}
        </span>
      </div>

      {/* Expert status cards */}
      <div className="space-y-2" role="region" aria-label="Expert analysis status">
        {EXPERT_ROLES.map(({ role, label }) => (
          <ExpertStatusCard key={role} role={role} label={label} phase={phase} />
        ))}
      </div>

      {/* Rehearsal ID */}
      {rehearsalId && (
        <p className="text-xs text-slate-500 font-mono" data-testid="rehearsal-id-panel">
          ID: {rehearsalId}
        </p>
      )}
    </div>
  );
}

function PhaseDot({ phase }: { phase: GenerationPhase }) {
  const dotColor: Record<GenerationPhase, string> = {
    QUEUED: 'bg-slate-500',
    COMPRESSING: 'bg-amber-400',
    SPECIALISTS_RUNNING: 'bg-teal-500',
    MODERATING: 'bg-teal-400',
    PERSISTING: 'bg-amber-400',
    READY: 'bg-safe',
    FAILED: 'bg-danger',
    CANCELLED: 'bg-slate-500',
    EXPIRED: 'bg-slate-500',
  };

  const isActive =
    phase === 'SPECIALISTS_RUNNING' || phase === 'COMPRESSING' || phase === 'MODERATING';

  return (
    <span className="relative flex h-3 w-3">
      {isActive && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor[phase]}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor[phase]}`} />
    </span>
  );
}

function ExpertStatusCard({
  role,
  label,
  phase,
}: {
  role: string;
  label: string;
  phase: GenerationPhase;
}) {
  const status = expertStatus(phase);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-navy-800/50 rounded-md border border-border">
      <span className="text-sm text-slate-200">{label}</span>
      <span
        className={`text-xs font-mono uppercase ${statusColor(status)}`}
        data-testid={`expert-${role}-status`}
      >
        {status}
      </span>
    </div>
  );
}

function expertStatus(phase: GenerationPhase): string {
  switch (phase) {
    case 'QUEUED':
      return 'waiting';
    case 'COMPRESSING':
      return 'waiting';
    case 'SPECIALISTS_RUNNING':
      return 'running';
    case 'MODERATING':
      return 'complete';
    case 'PERSISTING':
      return 'complete';
    case 'READY':
      return 'complete';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'waiting':
      return 'text-slate-500';
    case 'running':
      return 'text-teal-500';
    case 'complete':
      return 'text-safe';
    case 'failed':
      return 'text-danger';
    case 'cancelled':
      return 'text-slate-500';
    default:
      return 'text-slate-400';
  }
}

function phaseLabel(phase: GenerationPhase): string {
  const labels: Record<GenerationPhase, string> = {
    QUEUED: 'Queued',
    COMPRESSING: 'Compressing SOP',
    SPECIALISTS_RUNNING: 'Experts analyzing',
    MODERATING: 'Synthesizing results',
    PERSISTING: 'Saving results',
    READY: 'Results ready',
    FAILED: 'Analysis failed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return labels[phase];
}
