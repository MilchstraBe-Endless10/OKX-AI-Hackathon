import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CommandRoom from './scene/CommandRoom';
import SopInput from './components/SopInput';
import ProgressPanel from './components/ProgressPanel';
import CouncilResults from './components/CouncilResults';
import ProductWorkspace, { type ProductView } from './components/ProductWorkspace';
import IdentityPanel from './components/IdentityPanel';
import ShareReport from './components/ShareReport';
import ShareDialog from './components/ShareDialog';
import TeamManagement from './components/TeamManagement';
import DemoGuide from './components/DemoGuide';
import {
  A2mcpError,
  councilToScene,
  generateRehearsal,
  type A2mcpProblemDetails,
  type GenerationPhase,
  type UIPhase,
} from './lib/api';
import { productApi, type Member as ApiMember } from './lib/product-api';
import type {
  CouncilResult,
  DecisionEvaluation,
  Scene,
  SopInput as SopInputValue,
  SopRecord,
} from '@sopscape/contracts';
import {
  LOCALES,
  getInitialLocale,
  getMessages,
  resolveTheme,
  type LocaleCode,
  type ThemeMode,
} from './lib/preferences';
import { COUNCIL_FIXTURE, SCENE_FIXTURE } from './lib/fixtures';

const EMPTY_SCENE: Scene = {
  schemaVersion: '1.0.0',
  agentStates: [],
  evidenceNodes: [],
  riskPaths: [],
  decisionNodes: [],
  cameraCues: ['idle'],
  paletteToken: 'neutral',
};

const DEMO_SOP: SopInputValue = {
  title: '钓鱼邮件处置演示',
  content:
    '收到要求紧急付款或登录的邮件时，不要点击链接。通过独立渠道核验发件人，保留原始邮件证据，并向安全团队上报。',
  locale: 'zh-CN',
};

const EXPERT_COPY = {
  'procedure-analyst': {
    name: '流程分析员',
    label: 'PROCEDURE ANALYST',
    summary: '确认独立核验与安全上报必须先于任何链接操作。',
    color: 'cyan',
  },
  'risk-challenger': {
    name: '风险挑战者',
    label: 'RISK CHALLENGER',
    summary: '点击邮件内链接可能导致凭证泄漏并扩散到账户接管。',
    color: 'red',
  },
  'evidence-auditor': {
    name: '证据审计员',
    label: 'EVIDENCE AUDITOR',
    summary: 'SOP 未明确规定夜间无人值守时的升级联系人。',
    color: 'violet',
  },
} as const;

type SceneView = 'consensus' | 'risk' | 'evidence';
type AppView = 'command' | ProductView;

function savedTheme(): ThemeMode {
  const value = localStorage.getItem('sopscape-theme');
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}

function savedLocale(): LocaleCode {
  const value = localStorage.getItem('sopscape-locale');
  return LOCALES.some(({ code }) => code === value) ? (value as LocaleCode) : getInitialLocale();
}

export default function App() {
  // 检查是否是分享报告页面
  const sharePathMatch = window.location.pathname.match(/^\/r\/([a-zA-Z0-9_-]+)$/);
  if (sharePathMatch) {
    return <ShareReport />;
  }

  const [themeMode, setThemeMode] = useState<ThemeMode>(savedTheme);
  const [locale, setLocale] = useState<LocaleCode>(savedLocale);
  const messages = getMessages(locale);
  const [phase, setPhase] = useState<UIPhase>('idle');
  const [rehearsalId, setRehearsalId] = useState<string | null>(null);
  const [council, setCouncil] = useState<CouncilResult | null>(null);
  const [scene, setScene] = useState<Scene>(EMPTY_SCENE);
  const [submittedSop, setSubmittedSop] = useState<SopInputValue | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [sceneView, setSceneView] = useState<SceneView>('consensus');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<A2mcpProblemDetails | null>(null);
  const [activeView, setActiveView] = useState<AppView>('command');
  const [productRefresh, setProductRefresh] = useState(0);
  const [decisionEvaluations, setDecisionEvaluations] = useState<DecisionEvaluation[]>([]);
  const [currentSop, setCurrentSop] = useState<SopRecord | null>(null);
  const [trainingResult, setTrainingResult] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState<ApiMember | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const refreshAfterIdentityChange = useCallback(() => {
    setProductRefresh((value) => value + 1);
  }, []);

  useEffect(() => {
    productApi
      .me()
      .then(({ member }) => setCurrentMember(member))
      .catch(() => setCurrentMember(null));
  }, [productRefresh]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(themeMode, media.matches);
      document.documentElement.style.colorScheme =
        resolveTheme(themeMode, media.matches) === 'dark' ? 'dark' : 'light';
    };
    applyTheme();
    localStorage.setItem('sopscape-theme', themeMode);
    media.addEventListener?.('change', applyTheme);
    return () => media.removeEventListener?.('change', applyTheme);
  }, [themeMode]);

  useEffect(() => {
    const config = LOCALES.find(({ code }) => code === locale) ?? LOCALES[0];
    document.documentElement.lang = locale;
    document.documentElement.dir = config.dir;
    localStorage.setItem('sopscape-locale', locale);
  }, [locale]);

  useEffect(() => {
    if (!shellRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.from('[data-shell-panel]', {
        opacity: 0,
        y: 14,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power2.out',
      });
    }, shellRef);
    return () => context.revert();
  }, []);

  const progress =
    phase === 'idle'
      ? 0
      : phase === 'READY' || phase === 'FAILED' || phase === 'PARTIAL_FAILED'
        ? 100
        : 55;
  const firstChoiceId = council?.decisionNodes[0]?.options[0]?.id;
  const consensusScore = council?.consensus.length
    ? Math.round(
        (council.consensus.reduce((sum, finding) => sum + finding.confidence, 0) /
          council.consensus.length) *
          100,
      )
    : 0;
  const evidenceTotal = scene.evidenceNodes.length + (council?.evidenceGaps.length ?? 0);
  const decisionState =
    selectedDecision && selectedDecision === firstChoiceId
      ? 'risk'
      : selectedDecision
        ? 'safe'
        : null;

  async function startRehearsal(input: SopInputValue) {
    setSelectedDecision(null);
    setDecisionEvaluations([]);
    setCurrentSop(null);
    setTrainingResult(null);
    setErrorMessage(null);
    setErrorDetails(null);
    setSceneView('consensus');
    setRehearsalId(null);
    setCouncil(null);
    setScene(EMPTY_SCENE);
    setSubmittedSop(input);
    setPhase('SPECIALISTS_RUNNING');
    try {
      const response = await generateRehearsal(input);
      setRehearsalId(response.rehearsalId);
      setCouncil(response.council);
      setScene(councilToScene(response.council));
      setCurrentSop(response.sop ?? null);
      setProductRefresh((value) => value + 1);
      setPhase('READY');
    } catch (error) {
      if (error instanceof A2mcpError) {
        setErrorDetails(error.problem);
        setErrorMessage(error.message);
        setPhase(error.problem.rehearsalStatus === 'PARTIAL_FAILED' ? 'PARTIAL_FAILED' : 'FAILED');
      } else {
        setErrorDetails(null);
        setErrorMessage(error instanceof Error ? error.message : '未知错误，请稍后重试');
        setPhase('FAILED');
      }
    }
  }

  function resetRehearsal() {
    setSelectedDecision(null);
    setErrorMessage(null);
    setErrorDetails(null);
    setRehearsalId(null);
    setCouncil(null);
    setScene(EMPTY_SCENE);
    setSubmittedSop(null);
    setPhase('idle');
    setDecisionEvaluations([]);
    setCurrentSop(null);
    setTrainingResult(null);
  }

  function loadDemo() {
    setGuideOpen(false);
    setSelectedDecision(null);
    setDecisionEvaluations([]);
    setErrorMessage(null);
    setErrorDetails(null);
    setSubmittedSop(DEMO_SOP);
    setRehearsalId('demo-fixture-phishing');
    setCouncil(COUNCIL_FIXTURE);
    setScene(SCENE_FIXTURE);
    setCurrentSop(null);
    setTrainingResult(null);
    setPhase('READY');
  }

  async function chooseDecision(choiceId: string) {
    setSelectedDecision(choiceId);
    const node = council?.decisionNodes.find((candidate) =>
      candidate.options.some((option) => option.id === choiceId),
    );
    if (!rehearsalId || !node) return;
    try {
      const evaluation = await productApi.evaluate(rehearsalId, node.id, choiceId);
      const next = [
        ...decisionEvaluations.filter((item) => item.nodeId !== evaluation.nodeId),
        evaluation,
      ];
      setDecisionEvaluations(next);
      if (currentSop && council && next.length === council.decisionNodes.length) {
        const score = Math.max(
          0,
          Math.min(100, 50 + next.reduce((sum, item) => sum + item.scoreDelta, 0)),
        );
        const assignment = await productApi.assignTraining(currentSop.id, 'Demo Builder');
        const completed = await productApi.completeTraining(assignment.id, score, next);
        setTrainingResult(`${score}/100 · ${completed.report.summary}`);
      }
      setProductRefresh((value) => value + 1);
    } catch {
      setTrainingResult('训练结果保存失败，请重试最后一个节点。');
    }
  }

  return (
    <>
      <IdentityPanel onMember={refreshAfterIdentityChange} />
      {guideOpen && (
        <DemoGuide locale={locale} onLoadDemo={loadDemo} onClose={() => setGuideOpen(false)} />
      )}
      {shareDialogOpen && rehearsalId && (
        <ShareDialog rehearsalId={rehearsalId} onClose={() => setShareDialogOpen(false)} />
      )}
      {teamDialogOpen && currentMember && (
        <TeamManagement
          currentMemberId={currentMember.id}
          currentMemberRole={currentMember.role}
          onClose={() => {
            setTeamDialogOpen(false);
            setProductRefresh((value) => value + 1);
          }}
        />
      )}
      <div ref={shellRef} className="app-shell">
        <div className="app-rail" role="navigation" aria-label={messages.commandRoom}>
          <div className="brand-mark" role="img" aria-label="SOPscape Council" />
          <nav className="rail-nav">
            {(
              [
                ['⌂', messages.commandRoom, 'command'],
                ['▤', messages.navHistory, 'history'],
                ['◎', messages.navEvidence, 'evidence'],
                ['‹/›', messages.navProtocol, 'protocol'],
                ['◇', messages.navSecurity, 'security'],
              ] as const
            ).map(([icon, label, view]) => (
              <button
                key={label}
                className={`rail-button ${activeView === view ? 'is-active' : ''}`}
                aria-label={label}
                aria-current={activeView === view ? 'page' : undefined}
                onClick={() => setActiveView(view)}
              >
                <span aria-hidden="true">{icon}</span>
              </button>
            ))}
          </nav>
          <div className="rail-avatar">SC</div>
        </div>

        <main className="workspace">
          <header className="topbar" data-shell-panel>
            <div className="project-heading">
              <strong>SOPscape Council</strong>
              <span>TRACEABLE AI DECISION REHEARSAL</span>
            </div>
            <div className="phase-line" role="status" aria-label="当前演练进度">
              <span className="live-dot" />
              <span>
                {phase === 'idle'
                  ? messages.waitingInput
                  : phase === 'READY'
                    ? messages.resultReady
                    : phase === 'FAILED' || phase === 'PARTIAL_FAILED'
                      ? messages.callFailed
                      : messages.running}
              </span>
              <div className="phase-track">
                <i style={{ width: `${progress}%` }} />
              </div>
              <span>{progress}%</span>
            </div>
            <div className="preference-controls">
              <label>
                <span>{messages.theme}</span>
                <select
                  aria-label={messages.theme}
                  value={themeMode}
                  onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
                >
                  <option value="system">{messages.system}</option>
                  <option value="light">{messages.light}</option>
                  <option value="dark">{messages.dark}</option>
                </select>
              </label>
              <label>
                <span>{messages.language}</span>
                <select
                  aria-label={messages.language}
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as LocaleCode)}
                >
                  {LOCALES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="new-rehearsal"
              onClick={phase === 'idle' ? undefined : resetRehearsal}
            >
              {phase === 'idle' ? messages.online : `＋ ${messages.newRehearsal}`}
            </button>
            <button
              type="button"
              className="new-rehearsal"
              onClick={() => setGuideOpen(true)}
              data-testid="guide-trigger"
            >
              {locale === 'en-US' ? 'Guide & demo' : '演示 / 指南'}
            </button>
          </header>

          {activeView === 'command' ? (
            <section className="command-grid">
              <aside className="glass-panel expert-panel" data-shell-panel>
                <PanelHeading
                  title={messages.experts}
                  subtitle="COUNCIL AGENTS"
                  badge="3 / 3 VALID"
                />
                {phase === 'idle' ? (
                  <div className="panel-scroll input-scroll">
                    <SopInput onSubmit={startRehearsal} locale={locale} messages={messages} />
                  </div>
                ) : (
                  <div className="panel-scroll">
                    <article className="sop-brief">
                      <span>{messages.currentSop} · PHISHING RESPONSE</span>
                      <strong>{submittedSop?.title}</strong>
                      <p>{submittedSop?.content}</p>
                      <div>
                        <i>
                          {council?.recommendedPath.length ?? 0} {messages.recommendedSteps}
                        </i>
                        <i>
                          {council?.decisionNodes.length ?? 0} {messages.decisionNodes}
                        </i>
                        <i>{submittedSop?.locale ?? 'zh-CN'}</i>
                      </div>
                    </article>
                    {phase !== 'READY' && (
                      <ProgressPanel phase={phase as GenerationPhase} rehearsalId={rehearsalId} />
                    )}
                    <div className="expert-list">
                      {scene.agentStates.map((agent) => {
                        const copy = EXPERT_COPY[agent.id as keyof typeof EXPERT_COPY];
                        if (!copy) return null;
                        const score = Math.round(agent.confidence * 100);
                        const localizedName =
                          agent.id === 'procedure-analyst'
                            ? messages.procedureSeat
                            : agent.id === 'risk-challenger'
                              ? messages.riskSeat
                              : messages.evidenceSeat;
                        return (
                          <article key={agent.id} className={`expert-card expert-${copy.color}`}>
                            <div className="expert-card-head">
                              <span className="expert-symbol">{localizedName.slice(0, 1)}</span>
                              <div>
                                <strong>{localizedName}</strong>
                                <small>{copy.label}</small>
                              </div>
                              <b>{score}%</b>
                            </div>
                            <p>
                              {council?.consensus.find((finding) => finding.role === agent.id)
                                ?.claim ?? copy.summary}
                            </p>
                            <div className="expert-progress">
                              <i style={{ width: `${score}%` }} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
                <footer className="panel-footer">
                  <span>SceneDocument v1.0</span>
                  <b>{messages.schemaPassed}</b>
                </footer>
              </aside>

              <section
                className={`glass-panel scene-panel decision-${decisionState ?? 'idle'}`}
                data-shell-panel
              >
                <div className="scene-head">
                  <div>
                    <strong>{messages.commandRoom}</strong>
                    <span>
                      {selectedDecision ? messages.changedTopology : messages.waitingDecision}
                    </span>
                  </div>
                  <div className="scene-tabs" role="tablist" aria-label="场景视图">
                    {(['consensus', 'risk', 'evidence'] as const).map((view) => (
                      <button
                        key={view}
                        className={sceneView === view ? 'is-active' : ''}
                        onClick={() => setSceneView(view)}
                        role="tab"
                        aria-selected={sceneView === view}
                      >
                        {
                          {
                            consensus: messages.consensus,
                            risk: messages.risk,
                            evidence: messages.evidence,
                          }[view]
                        }
                      </button>
                    ))}
                  </div>
                </div>
                <div className="scene-stage">
                  <CommandRoom
                    phase={phase}
                    scene={scene}
                    decisionChoice={
                      decisionState === 'risk'
                        ? 'click'
                        : decisionState === 'safe'
                          ? 'verify'
                          : null
                    }
                    view={sceneView}
                    orbitLabel={messages.orbit}
                    resetLabel={messages.reset}
                  />
                  <article className="scene-seat seat-procedure">
                    <b>● {messages.procedureSeat}</b>
                    <span>{council?.recommendedPath.join(' → ') || messages.waitingAnalysis}</span>
                  </article>
                  <article className="scene-seat seat-risk">
                    <b>● {messages.riskSeat}</b>
                    <span>
                      {council?.disagreements.length ?? 0} {messages.disagreementPaths}
                    </span>
                  </article>
                  <article className="scene-seat seat-evidence">
                    <b>● {messages.evidenceSeat}</b>
                    <span>
                      {scene.evidenceNodes.length} {messages.evidenceItems} ·{' '}
                      {council?.evidenceGaps.length ?? 0} {messages.gaps}
                    </span>
                  </article>
                  <div className="core-caption">
                    <strong>
                      {decisionState === 'risk'
                        ? messages.riskActivated
                        : decisionState === 'safe'
                          ? messages.safePath
                          : messages.consensusCore}
                    </strong>
                    <span>
                      {decisionState === 'risk'
                        ? 'CREDENTIAL EXPOSURE'
                        : decisionState === 'safe'
                          ? 'RISK CONTAINED'
                          : 'CONSENSUS STABLE'}
                    </span>
                  </div>
                  <div className="scene-legend">
                    <span>● {messages.consensus}</span>
                    <span>● {messages.risk}</span>
                    <span>● {messages.evidence}</span>
                  </div>
                  <div className="scene-metrics">
                    <div>
                      <b>
                        {decisionState === 'safe'
                          ? '96%'
                          : decisionState === 'risk'
                            ? '42%'
                            : `${consensusScore}%`}
                      </b>
                      <span>{messages.consensusStrength}</span>
                    </div>
                    <div>
                      <b>
                        {decisionState === 'safe'
                          ? messages.riskLow
                          : decisionState === 'risk'
                            ? messages.riskHigh
                            : messages.riskMedium}
                      </b>
                      <span>{messages.currentRisk}</span>
                    </div>
                    <div>
                      <b>
                        {scene.evidenceNodes.length} / {evidenceTotal}
                      </b>
                      <span>{messages.evidenceCoverage}</span>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="glass-panel result-panel" data-shell-panel>
                <PanelHeading
                  title={messages.resultPanel}
                  subtitle="MODERATOR OUTPUT"
                  badge={rehearsalId ? rehearsalId.slice(-8) : 'A2MCP'}
                />
                <div className="panel-scroll result-scroll">
                  <CouncilResults
                    phase={phase}
                    rehearsalId={rehearsalId}
                    result={council}
                    errorMessage={errorMessage}
                    errorDetails={errorDetails}
                    messages={messages}
                    selectedDecision={selectedDecision}
                    onDecision={chooseDecision}
                    onShare={() => setShareDialogOpen(true)}
                  />
                  {decisionEvaluations.length > 0 && (
                    <article
                      className={`decision-coaching risk-${decisionEvaluations.at(-1)?.riskLevel ?? 'medium'}`}
                    >
                      <strong>
                        训练进度 {decisionEvaluations.length}/{council?.decisionNodes.length ?? 0} ·
                        当前{' '}
                        {Math.max(
                          0,
                          Math.min(
                            100,
                            50 +
                              decisionEvaluations.reduce((sum, item) => sum + item.scoreDelta, 0),
                          ),
                        )}
                        分
                      </strong>
                      <p>{decisionEvaluations.at(-1)?.consequence}</p>
                      <small>{trainingResult ?? decisionEvaluations.at(-1)?.coaching}</small>
                    </article>
                  )}
                </div>
              </aside>
            </section>
          ) : (
            <ProductWorkspace
              view={activeView}
              refreshToken={productRefresh}
              onOpenTeam={() => setTeamDialogOpen(true)}
            />
          )}
        </main>
      </div>
    </>
  );
}

function PanelHeading({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <b>{badge}</b>
    </div>
  );
}
