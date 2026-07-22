import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CommandRoom from './scene/CommandRoom';
import SopInput from './components/SopInput';
import ProgressPanel from './components/ProgressPanel';
import CouncilResults from './components/CouncilResults';
import { councilToScene, generateRehearsal, type GenerationPhase, type UIPhase } from './lib/api';
import type { CouncilResult, Scene, SopInput as SopInputValue } from '@sopscape/contracts';

const EMPTY_SCENE: Scene = {
  schemaVersion: '1.0.0',
  agentStates: [],
  evidenceNodes: [],
  riskPaths: [],
  decisionNodes: [],
  cameraCues: ['idle'],
  paletteToken: 'neutral',
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

export default function App() {
  const [phase, setPhase] = useState<UIPhase>('idle');
  const [rehearsalId, setRehearsalId] = useState<string | null>(null);
  const [council, setCouncil] = useState<CouncilResult | null>(null);
  const [scene, setScene] = useState<Scene>(EMPTY_SCENE);
  const [submittedSop, setSubmittedSop] = useState<SopInputValue | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [sceneView, setSceneView] = useState<SceneView>('consensus');
  const shellRef = useRef<HTMLDivElement>(null);

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

  const progress = phase === 'idle' ? 0 : phase === 'READY' || phase === 'FAILED' ? 100 : 55;
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
      setPhase('READY');
    } catch {
      setPhase('FAILED');
    }
  }

  function resetRehearsal() {
    setSelectedDecision(null);
    setRehearsalId(null);
    setCouncil(null);
    setScene(EMPTY_SCENE);
    setSubmittedSop(null);
    setPhase('idle');
  }

  return (
    <div ref={shellRef} className="app-shell">
      <div className="app-rail" role="navigation" aria-label="主导航">
        <div className="brand-mark" aria-label="SOPscape Council" />
        <nav className="rail-nav">
          {[
            ['⌂', '议会指挥室'],
            ['▤', '演练记录'],
            ['◎', '证据档案'],
            ['‹/›', '协议接口'],
            ['◇', '安全与权限'],
          ].map(([icon, label], index) => (
            <button
              key={label}
              className={`rail-button ${index === 0 ? 'is-active' : ''}`}
              aria-label={label}
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
          <div className="phase-line" aria-label="当前演练进度">
            <span className="live-dot" />
            <span>
              {phase === 'idle'
                ? '等待 SOP 输入'
                : phase === 'READY'
                  ? '议会结果已生成'
                  : phase === 'FAILED'
                    ? 'A2MCP 调用失败'
                    : '三专家正在审议'}
            </span>
            <div className="phase-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
          <button className="new-rehearsal" onClick={phase === 'idle' ? undefined : resetRehearsal}>
            {phase === 'idle' ? 'A2MCP 在线' : '＋ 新建演练'}
          </button>
        </header>

        <section className="command-grid">
          <aside className="glass-panel expert-panel" data-shell-panel>
            <PanelHeading title="专家席位" subtitle="COUNCIL AGENTS" badge="3 / 3 VALID" />
            {phase === 'idle' ? (
              <div className="panel-scroll input-scroll">
                <SopInput onSubmit={startRehearsal} />
              </div>
            ) : (
              <div className="panel-scroll">
                <article className="sop-brief">
                  <span>当前 SOP · PHISHING RESPONSE</span>
                  <strong>{submittedSop?.title}</strong>
                  <p>{submittedSop?.content}</p>
                  <div>
                    <i>{council?.recommendedPath.length ?? 0} 个推荐步骤</i>
                    <i>{council?.decisionNodes.length ?? 0} 个决策节点</i>
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
                    return (
                      <article key={agent.id} className={`expert-card expert-${copy.color}`}>
                        <div className="expert-card-head">
                          <span className="expert-symbol">{copy.name.slice(0, 1)}</span>
                          <div>
                            <strong>{copy.name}</strong>
                            <small>{copy.label}</small>
                          </div>
                          <b>{score}%</b>
                        </div>
                        <p>
                          {council?.consensus.find((finding) => finding.role === agent.id)?.claim ??
                            copy.summary}
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
              <b>Schema 已通过</b>
            </footer>
          </aside>

          <section
            className={`glass-panel scene-panel decision-${decisionState ?? 'idle'}`}
            data-shell-panel
          >
            <div className="scene-head">
              <div>
                <strong>议会指挥室</strong>
                <span>{selectedDecision ? '决策已改变风险拓扑' : '共识已建立 · 等待用户决策'}</span>
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
                    {{ consensus: '共识', risk: '风险', evidence: '证据' }[view]}
                  </button>
                ))}
              </div>
            </div>
            <div className="scene-stage">
              <CommandRoom
                phase={phase}
                scene={scene}
                decisionChoice={
                  decisionState === 'risk' ? 'click' : decisionState === 'safe' ? 'verify' : null
                }
                view={sceneView}
              />
              <article className="scene-seat seat-procedure">
                <b>● 流程席位</b>
                <span>{council?.recommendedPath.join(' → ') || '等待 A2MCP 分析'}</span>
              </article>
              <article className="scene-seat seat-risk">
                <b>● 风险席位</b>
                <span>{council?.disagreements.length ?? 0} 条分歧路径</span>
              </article>
              <article className="scene-seat seat-evidence">
                <b>● 证据席位</b>
                <span>
                  {scene.evidenceNodes.length} 项证据 · {council?.evidenceGaps.length ?? 0} 项缺口
                </span>
              </article>
              <div className="core-caption">
                <strong>
                  {decisionState === 'risk'
                    ? '风险链路激活'
                    : decisionState === 'safe'
                      ? '安全处置路径'
                      : '中央共识核心'}
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
                <span>● 共识</span>
                <span>● 风险路径</span>
                <span>● 证据缺口</span>
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
                  <span>共识强度</span>
                </div>
                <div>
                  <b>{decisionState === 'safe' ? '低' : decisionState === 'risk' ? '高' : '中'}</b>
                  <span>当前风险</span>
                </div>
                <div>
                  <b>
                    {scene.evidenceNodes.length} / {evidenceTotal}
                  </b>
                  <span>证据覆盖</span>
                </div>
              </div>
            </div>
          </section>

          <aside className="glass-panel result-panel" data-shell-panel>
            <PanelHeading
              title="议会结果"
              subtitle="MODERATOR OUTPUT"
              badge={rehearsalId ? rehearsalId.slice(-8) : 'A2MCP'}
            />
            <div className="panel-scroll result-scroll">
              <CouncilResults
                phase={phase}
                rehearsalId={rehearsalId}
                result={council}
                selectedDecision={selectedDecision}
                onDecision={setSelectedDecision}
              />
            </div>
          </aside>
        </section>
      </main>
    </div>
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
