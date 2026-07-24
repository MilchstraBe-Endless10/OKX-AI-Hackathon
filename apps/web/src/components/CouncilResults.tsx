import type { A2mcpProblemDetails, UIPhase } from '../lib/api';
import type { CouncilResult } from '@sopscape/contracts';
import { getMessages, type AppMessages } from '../lib/preferences';

interface CouncilResultsProps {
  phase: UIPhase;
  rehearsalId: string | null;
  result: CouncilResult | null;
  errorMessage?: string | null;
  errorDetails?: A2mcpProblemDetails | null;
  messages?: AppMessages;
  selectedDecision?: string | null;
  onDecision?: (choiceId: string) => void;
  onShare?: () => void;
}

export default function CouncilResults({
  phase,
  rehearsalId,
  result,
  errorMessage = null,
  errorDetails = null,
  messages,
  selectedDecision = null,
  onDecision,
  onShare,
}: CouncilResultsProps) {
  const copy = messages ?? getMessages('zh-CN');
  const isFailed = phase === 'FAILED' || phase === 'PARTIAL_FAILED';
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
        <h2 className="text-base font-semibold text-slate-100 mb-2">{copy.resultTitle}</h2>
        <p className="text-sm text-slate-400">{copy.emptyBody}</p>
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
        <h2 className="text-base font-semibold text-danger mb-2">{copy.failedTitle}</h2>
        <p className="text-sm text-slate-300">{errorMessage ?? copy.callFailed}</p>
        {errorDetails?.status && (
          <p className="mt-2 text-xs text-slate-400" data-testid="council-error-status">
            HTTP {errorDetails.status}
            {errorDetails.code ? ` · ${errorDetails.code}` : ''}
          </p>
        )}
        {errorDetails?.failedExperts && errorDetails.failedExperts.length > 0 && (
          <p className="mt-1 text-xs text-danger/90" data-testid="failed-experts">
            失败专家：
            {errorDetails.failedExperts.map((item) => item.expert ?? 'unknown').join('、')}
          </p>
        )}
        {errorDetails?.requestId && (
          <p className="mt-1 text-xs text-slate-500 font-mono" data-testid="error-request-id">
            requestId: {errorDetails.requestId}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400">{copy.retry}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-3"
        data-testid="council-loading"
      >
        <h2 className="text-base font-semibold text-slate-100">{copy.loadingTitle}</h2>
        <div className="space-y-2">
          {['共识', '分歧', '证据缺口', '决策'].map((section) => (
            <div key={section} className="h-8 bg-navy-800/50 rounded animate-pulse" />
          ))}
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          {copy.loadingText}
        </p>
      </div>
    );
  }

  if (!result) {
    return <div role="alert">{copy.retry}</div>;
  }

  return (
    <div
      className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-4"
      data-testid="council-ready"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">{copy.resultTitle}</h2>
        {onShare && rehearsalId && (
          <button
            onClick={onShare}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface text-slate-300 hover:text-slate-100 hover:bg-surface/80 transition-colors"
          >
            分享报告
          </button>
        )}
      </div>

      {/* Consensus */}
      <section aria-label={copy.consensus}>
        <h3 className="text-sm font-medium text-safe mb-2">{copy.consensus}</h3>
        <Consensus findings={result.consensus} />
      </section>

      {/* Disagreements */}
      <section aria-label={copy.disagreements}>
        <h3 className="text-sm font-medium text-caution mb-2">{copy.disagreements}</h3>
        <Disagreements
          disagreements={result.disagreements}
          evidenceGaps={result.evidenceGaps}
          copy={copy}
        />
      </section>

      {/* Decision Nodes */}
      <section aria-label={copy.decisions}>
        <h3 className="text-sm font-medium text-teal-400 mb-2">{copy.decisions}</h3>
        <Decisions
          rehearsalId={rehearsalId}
          nodes={result.decisionNodes}
          selectedDecision={selectedDecision}
          onDecision={onDecision}
          copy={copy}
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
  copy,
}: {
  disagreements: CouncilResult['disagreements'];
  evidenceGaps: CouncilResult['evidenceGaps'];
  copy: AppMessages;
}) {
  return (
    <div className="space-y-2 text-sm">
      {disagreements.length === 0 && evidenceGaps.length === 0 ? (
        <p className="text-slate-400">{copy.disagreements}: 0</p>
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
          {copy.evidence}: {gap.description}
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
  copy,
}: {
  rehearsalId: string | null;
  nodes: CouncilResult['decisionNodes'];
  selectedDecision: string | null;
  onDecision?: (choiceId: string) => void;
  copy: AppMessages;
}) {
  const riskyChoiceId = nodes[0]?.options[0]?.id;
  const isSafe = selectedDecision !== riskyChoiceId;

  return (
    <div className="space-y-2">
      {rehearsalId && <p className="text-xs text-slate-500 font-mono">A2MCP · {rehearsalId}</p>}
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
          <strong>{isSafe ? copy.safePath : copy.riskActivated}</strong>
          <p>
            {isSafe
              ? `${copy.currentRisk}: ${copy.riskLow} · ${copy.evidence}: ${copy.schemaPassed}`
              : `${copy.currentRisk}: ${copy.riskHigh} · ${copy.riskActivated}`}
          </p>
        </div>
      )}
    </div>
  );
}
