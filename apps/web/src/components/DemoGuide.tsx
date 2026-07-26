import type { ReactNode } from 'react';
import type { LocaleCode } from '../lib/preferences';

interface DemoGuideProps {
  locale: LocaleCode;
  onLoadDemo: () => void;
  onClose: () => void;
}

export default function DemoGuide({ locale, onLoadDemo, onClose }: DemoGuideProps) {
  // Keep non-Chinese locales internally consistent until the full product workspace
  // dictionary is expanded; do not mix Chinese labels into an otherwise translated view.
  const english = locale !== 'zh-CN';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-guide-title"
    >
      <article className="glass-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl p-6 shadow-2xl">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-teal-300">
              SOPSCAPE QUICK START
            </span>
            <h2 id="demo-guide-title" className="mt-1 text-xl font-semibold text-slate-100">
              {english ? 'Demo & operation guide' : '演示与操作指南'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {english
                ? 'Try the complete decision loop without calling the model or changing workspace data.'
                : '使用内置 Fixture 体验完整决策闭环，不调用真实模型，也不会修改工作区数据。'}
            </p>
          </div>
          <button
            type="button"
            className="rail-button"
            onClick={onClose}
            aria-label={english ? 'Close guide' : '关闭指南'}
          >
            ×
          </button>
        </header>

        <button
          type="button"
          onClick={onLoadDemo}
          className="mb-6 w-full rounded-lg border border-teal-400/50 bg-teal-400/10 px-4 py-3 text-left transition hover:bg-teal-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          data-testid="load-demo"
        >
          <strong className="block text-teal-200">
            {english ? 'Launch phishing rehearsal' : '一键启动钓鱼邮件演示'}
          </strong>
          <span className="mt-1 block text-sm text-slate-300">
            {english
              ? 'Loads a checked-in fixture and opens the 3D command room.'
              : '加载已校验的钓鱼邮件 Fixture，并打开 3D 指挥室。'}
          </span>
        </button>

        <div className="grid gap-4 md:grid-cols-2">
          <GuideSection title={english ? 'Five-minute walkthrough' : '五分钟操作流程'}>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
              <li>{english ? 'Log in with your workspace account.' : '使用工作区账号登录。'}</li>
              <li>
                {english
                  ? 'Enter or import an SOP, then start a rehearsal.'
                  : '输入或导入 SOP，启动议会演练。'}
              </li>
              <li>
                {english
                  ? 'Read the three seats: procedure, risk and evidence.'
                  : '查看流程、风险、证据三名专家席位。'}
              </li>
              <li>
                {english
                  ? 'Orbit the room with middle-mouse drag; use tabs to inspect risk and evidence.'
                  : '按住鼠标中键旋转指挥室，用标签查看风险和证据。'}
              </li>
              <li>
                {english
                  ? 'Choose every decision node to receive a score and coaching report.'
                  : '完成所有决策节点，获得评分和训练复盘。'}
              </li>
            </ol>
          </GuideSection>
          <GuideSection title={english ? 'What each area does' : '各功能区作用'}>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <b className="text-cyan-200">Command room</b>：
                {english
                  ? '3D consensus, risk paths and evidence gaps.'
                  : '共识、风险路径与证据缺口。'}
              </li>
              <li>
                <b className="text-violet-200">History</b>：
                {english
                  ? 'Reopen saved rehearsals and compare versions.'
                  : '重新打开历史演练并比较版本。'}
              </li>
              <li>
                <b className="text-amber-200">Evidence</b>：
                {english ? 'Review missing proof and audit events.' : '查看证据缺口与审计记录。'}
              </li>
              <li>
                <b className="text-teal-200">Protocol</b>：
                {english ? 'Inspect A2MCP and MCP request shapes.' : '查看 A2MCP 与 MCP 调用格式。'}
              </li>
              <li>
                <b className="text-rose-200">Security</b>：
                {english ? 'Manage members, roles and share access.' : '管理成员、角色和分享权限。'}
              </li>
            </ul>
          </GuideSection>
        </div>

        <GuideSection title={english ? 'Feature reference' : '完整功能说明'}>
          <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <p>
              <b className="text-slate-100">1. SOP 输入</b>：
              {english
                ? 'Paste text or import TXT, Markdown, JSON, CSV, EML, PDF or DOCX.'
                : '粘贴正文，或导入 TXT、Markdown、JSON、CSV、EML、PDF、DOCX。'}
            </p>
            <p>
              <b className="text-slate-100">2. 三专家审查</b>：
              {english
                ? 'Procedure, risk and evidence agents run in parallel.'
                : '流程、风险、证据三名专家并行审查。'}
            </p>
            <p>
              <b className="text-slate-100">3. 决策训练</b>：
              {english
                ? 'Select every node to calculate score, consequence and coaching.'
                : '逐个选择决策节点，计算分数、后果和教练建议。'}
            </p>
            <p>
              <b className="text-slate-100">4. 历史与版本</b>：
              {english
                ? 'Reopen rehearsals, compare SOP versions and inspect readiness.'
                : '重新打开演练、比较 SOP 版本并查看数字护照。'}
            </p>
            <p>
              <b className="text-slate-100">5. 团队与权限</b>：
              {english
                ? 'Owner manages members; Editor writes; Viewer reads.'
                : 'Owner 管理成员，Editor 执行业务写入，Viewer 只读。'}
            </p>
            <p>
              <b className="text-slate-100">6. 分享与审计</b>：
              {english
                ? 'Create read-only share links and review audit events.'
                : '创建只读分享链接并查看审计事件。'}
            </p>
            <p>
              <b className="text-slate-100">7. A2MCP / MCP</b>：
              {english
                ? 'Use the public free rehearsal endpoint or protected MCP protocol.'
                : '使用免费的公共演练端点，或使用受保护的 MCP 协议。'}
            </p>
            <p>
              <b className="text-slate-100">8. 安全</b>：
              {english
                ? 'HTTPS, API key auth, RBAC, rate limits and safe error responses protect the service.'
                : 'HTTPS、API Key、RBAC、限流和安全错误响应保护服务。'}
            </p>
          </div>
        </GuideSection>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-slate-500">
          <span>
            {english
              ? 'Demo mode is local-only and does not consume model quota.'
              : '演示模式仅在浏览器本地运行，不消耗模型额度。'}
          </span>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-slate-200 hover:border-teal-400"
            onClick={onClose}
          >
            {english ? 'Back to workspace' : '返回工作区'}
          </button>
        </footer>
      </article>
    </div>
  );
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-navy-900/60 p-4">
      <h3 className="mb-3 font-medium text-slate-100">{title}</h3>
      {children}
    </section>
  );
}
