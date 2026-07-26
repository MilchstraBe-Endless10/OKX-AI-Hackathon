import { GenerationPhase } from '../lib/api';
import { getMessages, type AppMessages } from '../lib/preferences';

const EXPERT_ROLES: { role: string; message: keyof AppMessages }[] = [
  { role: 'procedure-analyst', message: 'procedureSeat' },
  { role: 'risk-challenger', message: 'riskSeat' },
  { role: 'evidence-auditor', message: 'evidenceSeat' },
];

interface ProgressPanelProps {
  phase: GenerationPhase;
  rehearsalId: string | null;
  messages?: AppMessages;
}

export default function ProgressPanel({ phase, rehearsalId, messages }: ProgressPanelProps) {
  const copy = messages ?? getMessages('zh-CN');
  return (
    <div className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-4">
      <h2 className="text-base font-semibold text-slate-100">{copy.progressTitle}</h2>

      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <PhaseDot phase={phase} />
        <span className="text-sm text-slate-300" data-testid="current-phase">
          {phaseLabel(phase, copy)}
        </span>
      </div>

      {/* Expert status cards */}
      <div className="space-y-2" role="region" aria-label={copy.expertStatusLabel}>
        {EXPERT_ROLES.map(({ role, message }) => (
          <ExpertStatusCard
            key={role}
            role={role}
            label={copy[message]}
            phase={phase}
            messages={copy}
          />
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
    PARTIAL_FAILED: 'bg-danger',
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
  messages,
}: {
  role: string;
  label: string;
  phase: GenerationPhase;
  messages: AppMessages;
}) {
  const status = expertStatus(phase, messages);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-navy-800/50 rounded-md border border-border">
      <span className="text-sm text-slate-200">{label}</span>
      <span
        className={`text-xs font-mono uppercase ${statusColor(phase)}`}
        data-testid={`expert-${role}-status`}
      >
        {status}
      </span>
    </div>
  );
}

function expertStatus(phase: GenerationPhase, messages: AppMessages): string {
  switch (phase) {
    case 'QUEUED':
      return messages.statusWaiting;
    case 'COMPRESSING':
      return messages.statusWaiting;
    case 'SPECIALISTS_RUNNING':
      return messages.statusRunning;
    case 'MODERATING':
      return messages.statusComplete;
    case 'PERSISTING':
      return messages.statusComplete;
    case 'READY':
      return messages.statusComplete;
    case 'FAILED':
    case 'PARTIAL_FAILED':
      return messages.statusFailed;
    case 'CANCELLED':
    case 'EXPIRED':
      return messages.statusCancelled;
    default:
      return messages.statusWaiting;
  }
}

function statusColor(phase: GenerationPhase): string {
  switch (phase) {
    case 'QUEUED':
    case 'COMPRESSING':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'text-slate-500';
    case 'SPECIALISTS_RUNNING':
      return 'text-teal-500';
    case 'MODERATING':
    case 'PERSISTING':
    case 'READY':
      return 'text-safe';
    case 'FAILED':
    case 'PARTIAL_FAILED':
      return 'text-danger';
    default:
      return 'text-slate-400';
  }
}

function phaseLabel(phase: GenerationPhase, messages: AppMessages): string {
  const labels: Record<GenerationPhase, string> = {
    QUEUED: messages.statusWaiting,
    COMPRESSING: messages.statusWaiting,
    SPECIALISTS_RUNNING: messages.statusRunning,
    MODERATING: messages.statusComplete,
    PERSISTING: messages.statusComplete,
    READY: messages.resultReady,
    PARTIAL_FAILED: messages.statusFailed,
    FAILED: messages.statusFailed,
    CANCELLED: messages.statusCancelled,
    EXPIRED: messages.statusCancelled,
  };
  return labels[phase];
}
