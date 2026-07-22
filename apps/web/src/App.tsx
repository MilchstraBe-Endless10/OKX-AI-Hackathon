import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CommandRoom from './scene/CommandRoom';
import SopInput from './components/SopInput';
import ProgressPanel from './components/ProgressPanel';
import CouncilResults from './components/CouncilResults';
import type { GenerationPhase, UIPhase } from './lib/api';
import { COUNCIL_FIXTURE, SCENE_FIXTURE } from './lib/fixtures';

const FIXTURE_PHASES: GenerationPhase[] = [
  'COMPRESSING',
  'SPECIALISTS_RUNNING',
  'MODERATING',
  'PERSISTING',
  'READY',
];

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
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [sceneView, setSceneView] = useState<SceneView>('consensus');
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === 'idle' || phase === 'READY') return;
    const nextPhase = FIXTURE_PHASES[FIXTURE_PHASES.indexOf(phase) + 1];
    if (!nextPhase) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 700;
    const timer = window.setTimeout(() => setPhase(nextPhase), delay);
    return () => window.clearTimeout(timer);
  }, [phase]);

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

  const phaseIndex = phase === 'idle' ? 0 : Math.max(FIXTURE_PHASES.indexOf(phase) + 1, 1);
  const progress = phase === 'READY' ? 100 : Math.round((phaseIndex / FIXTURE_PHASES.length) * 100);
  const decisionState =
    selectedDecision === 'click' ? 'risk' : selectedDecision === 'verify' ? 'safe' : null;

  function startRehearsal() {
    setSelectedDecision(null);
    setSceneView('consensus');
    setRehearsalId('fixture-rehearsal-001');
    setPhase('COMPRESSING');
  }

  function resetRehearsal() {
    setSelectedDecision(null);
    setRehearsalId(null);
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
                  : '三专家正在审议'}
            </span>
            <div className="phase-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
          <button className="new-rehearsal" onClick={phase === 'idle' ? undefined : resetRehearsal}>
            {phase === 'idle' ? 'Fixture 演示' : '＋ 新建演练'}
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
                  <strong>收到疑似钓鱼邮件后的处置流程</strong>
                  <p>核验身份、隔离风险并完成安全上报。当前演练包含一个关键决策节点。</p>
                  <div>
                    <i>5 个流程步骤</i>
                    <i>高风险</i>
                    <i>中文</i>
                  </div>
                </article>
                {phase !== 'READY' && (
                  <ProgressPanel phase={phase as GenerationPhase} rehearsalId={rehearsalId} />
                )}
                <div className="expert-list">
                  {SCENE_FIXTURE.agentStates.map((agent) => {
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
                        <p>{copy.summary}</p>
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
                scene={SCENE_FIXTURE}
                decisionChoice={selectedDecision}
                view={sceneView}
              />
              <article className="scene-seat seat-procedure">
                <b>● 流程席位</b>
                <span>独立核验 → 截图留证 → 上报</span>
              </article>
              <article className="scene-seat seat-risk">
                <b>● 风险席位</b>
                <span>链接点击 → 凭证泄漏 → 接管</span>
              </article>
              <article className="scene-seat seat-evidence">
                <b>● 证据席位</b>
                <span>2 项证据 · 1 项缺口</span>
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
                    {decisionState === 'safe' ? '96%' : decisionState === 'risk' ? '42%' : '86%'}
                  </b>
                  <span>共识强度</span>
                </div>
                <div>
                  <b>{decisionState === 'safe' ? '低' : '高'}</b>
                  <span>当前风险</span>
                </div>
                <div>
                  <b>4 / 5</b>
                  <span>证据覆盖</span>
                </div>
              </div>
            </div>
          </section>

          <aside className="glass-panel result-panel" data-shell-panel>
            <PanelHeading
              title="议会结果"
              subtitle="MODERATOR OUTPUT"
              badge={rehearsalId ? 'R-24-071' : 'FIXTURE'}
            />
            <div className="panel-scroll result-scroll">
              <CouncilResults
                phase={phase}
                rehearsalId={rehearsalId}
                result={COUNCIL_FIXTURE}
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
