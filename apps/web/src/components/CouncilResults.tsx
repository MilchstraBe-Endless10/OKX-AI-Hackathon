import type { UIPhase } from '../lib/api';
import type { CouncilResult } from '@sopscape/contracts';

interface CouncilResultsProps {
  phase: UIPhase;
  rehearsalId: string | null;
  result: CouncilResult | null;
  selectedDecision?: string | null;
  onDecision?: (choiceId: string) => void;
}

export default function CouncilResults({
  phase,
  rehearsalId,
  result,
  selectedDecision = null,
  onDecision,
}: CouncilResultsProps) {
  const isFailed = phase === 'FAILED';
  const isLoading =
    phase !== 'READY' &&
    phase !== 'FAILED' &&
    phase !== 'idle' &&
    phase !== 'CANCELLED' &&
    phase !== 'EXPIRED';

  if (phase === 'idle' || phase === 'QUEUED') {
    return (
      <div
        className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4"
        data-testid="council-empty"
      >
        <h2 className="text-base font-semibold text-slate-100 mb-2">Council Results</h2>
        <p className="text-sm text-slate-400">
          Submit an SOP to begin analysis. Three experts will review your procedure.
        </p>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div
        className="bg-surface/90 backdrop-blur rounded-lg border border-danger/30 p-4"
        data-testid="council-error"
        role="alert"
      >
        <h2 className="text-base font-semibold text-danger mb-2">Analysis Failed</h2>
        <p className="text-sm text-slate-300">
          One or more experts could not complete analysis. Check the error details and try again.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-3"
        data-testid="council-loading"
      >
        <h2 className="text-base font-semibold text-slate-100">Council Results</h2>
        <div className="space-y-2">
          {['Consensus', 'Disagreements', 'Evidence Gaps', 'Decisions'].map((section) => (
            <div key={section} className="h-8 bg-navy-800/50 rounded animate-pulse" />
          ))}
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          Waiting for analysis to complete…
        </p>
      </div>
    );
  }

  if (!result) {
    return <div role="alert">A2MCP returned no council result.</div>;
  }

  // READY state — show fixture results
  return (
    <div
      className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-4"
      data-testid="council-ready"
    >
      <h2 className="text-base font-semibold text-slate-100">Council Results</h2>

      {/* Consensus */}
      <section aria-label="Consensus findings">
        <h3 className="text-sm font-medium text-safe mb-2">Consensus</h3>
        <Consensus findings={result.consensus} />
      </section>

      {/* Disagreements */}
      <section aria-label="Expert disagreements">
        <h3 className="text-sm font-medium text-caution mb-2">Disagreements</h3>
        <Disagreements disagreements={result.disagreements} evidenceGaps={result.evidenceGaps} />
      </section>

      {/* Decision Nodes */}
      <section aria-label="Decision points">
        <h3 className="text-sm font-medium text-teal-400 mb-2">Decision Points</h3>
        <Decisions
          rehearsalId={rehearsalId}
          nodes={result.decisionNodes}
          selectedDecision={selectedDecision}
          onDecision={onDecision}
        />
      </section>
    </div>
  );
}

function Consensus({ findings }: { findings: CouncilResult['consensus'] }) {
  return (
    <ul className="space-y-2 text-sm">
      {findings.map((finding) => (
        <li key={`${finding.role}-${finding.claim}`} className="flex items-start gap-2">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-safe shrink-0" />
          <span className="text-slate-300">{finding.claim}</span>
        </li>
      ))}
    </ul>
  );
}

function Disagreements({
  disagreements,
  evidenceGaps,
}: {
  disagreements: CouncilResult['disagreements'];
  evidenceGaps: CouncilResult['evidenceGaps'];
}) {
  return (
    <div className="space-y-2 text-sm">
      {disagreements.length === 0 && evidenceGaps.length === 0 ? (
        <p className="text-slate-400">No unresolved disagreements or evidence gaps.</p>
      ) : null}
      {disagreements.map((item) => (
        <div
          key={item.topic}
          className="px-3 py-2 bg-navy-800/50 rounded-md border border-caution/20"
        >
          <p className="text-caution font-medium">{item.topic}</p>
          {item.positions.map((position) => (
            <p key={`${position.role}-${position.stance}`} className="text-slate-300">
              {position.role}: {position.stance}
            </p>
          ))}
        </div>
      ))}
      {evidenceGaps.map((gap) => (
        <p key={gap.description} className="text-slate-300">
          Evidence gap: {gap.description}
        </p>
      ))}
    </div>
  );
}

function Decisions({
  rehearsalId,
  nodes,
  selectedDecision,
  onDecision,
}: {
  rehearsalId: string | null;
  nodes: CouncilResult['decisionNodes'];
  selectedDecision: string | null;
  onDecision?: (choiceId: string) => void;
}) {
  const riskyChoiceId = nodes[0]?.options[0]?.id;
  const isSafe = selectedDecision !== riskyChoiceId;

  return (
    <div className="space-y-2">
      {rehearsalId && <p className="text-xs text-slate-500 font-mono">Session {rehearsalId}</p>}
      {nodes.map((node) => (
        <div key={node.id} className="px-3 py-3 bg-navy-800/50 rounded-md border border-border">
          <p className="text-sm text-slate-200 font-medium mb-2">{node.prompt}</p>
          <div className="space-y-1.5">
            {node.options.map((option, index) => (
              <button
                key={option.id}
                className="w-full text-left px-3 py-2 rounded bg-navy-700/50 hover:bg-navy-700 text-sm text-slate-200 border border-border hover:border-teal-500/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                data-testid={`decision-option-${index === 0 ? 'a' : index === 1 ? 'b' : index}`}
                aria-pressed={selectedDecision === option.id}
                onClick={() => onDecision?.(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {selectedDecision && (
        <div
          className={`decision-result ${isSafe ? 'is-safe' : 'is-risk'}`}
          role="status"
          aria-live="polite"
        >
          <strong>{isSafe ? '安全路径已锁定' : '风险路径已触发'}</strong>
          <p>
            {isSafe
              ? '核心转为稳定态，风险链路收束，并记录独立核验与上报。'
              : '核心进入告警态，凭证泄漏路径被高亮，建议立即隔离并修改密码。'}
          </p>
        </div>
      )}
    </div>
  );
}
