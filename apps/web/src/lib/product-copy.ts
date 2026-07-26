import type { LocaleCode } from './preferences';

export type ProductCopy = {
  historyTitle: string;
  historySubtitle: string;
  evidenceTitle: string;
  evidenceSubtitle: string;
  protocolTitle: string;
  protocolSubtitle: string;
  securityTitle: string;
  securitySubtitle: string;
  workspaceTagline: string;
  exportReport: string;
  assignTraining: string;
  assignedTraining: string;
  sopCount: string;
  publishable: string;
  needsReview: string;
  blocked: string;
  sopVersions: string;
  noSop: string;
  createVersion: string;
  saveReview: string;
  compareVersions: string;
  copyShare: string;
  noHistory: string;
  evidenceChain: string;
  evidenceSubtitleShort: string;
  protocolToolStatus: string;
  phishingScenario: string;
  trainingAssigned: string;
  trainingWaiting: string;
  teamManagement: string;
  inviteCollaborator: string;
  generateInvite: string;
  copyInvite: string;
  noItems: string;
};

const EN: ProductCopy = {
  historyTitle: 'SOP passport & version center',
  historySubtitle: 'History, versions, sharing and collaboration',
  evidenceTitle: 'Evidence archive & release gates',
  evidenceSubtitle: 'Every decision links back to evidence',
  protocolTitle: 'Phishing rehearsal & A2MCP protocol',
  protocolSubtitle: 'Review, generation, decisions and version comparison tools',
  securityTitle: 'Security, team & audit console',
  securitySubtitle: 'Auth, rate limits, audit, abuse protection and stable APIs',
  workspaceTagline: 'Traceable, trainable, auditable',
  exportReport: 'Export training report',
  assignTraining: 'Assign rehearsal',
  assignedTraining: 'Assigned to team',
  sopCount: 'SOP count',
  publishable: 'Publishable',
  needsReview: 'Needs review',
  blocked: 'Blocked',
  sopVersions: 'SOPs & versions',
  noSop: 'Submit an SOP in the command room to create its digital passport.',
  createVersion: 'Create new version',
  saveReview: 'Save and review',
  compareVersions: 'Compare latest versions',
  copyShare: 'Copy share link',
  noHistory: 'No SOP history yet.',
  evidenceChain: 'Evidence chain & readiness gates',
  evidenceSubtitleShort: 'Every finding links back to a cited source',
  protocolToolStatus: 'Auth, rate limits, Schema validation and audit logs are enabled.',
  phishingScenario: 'Phishing email response rehearsal',
  trainingAssigned: 'Team training assigned; the result will enter the audit log.',
  trainingWaiting: 'Waiting for team training assignment.',
  teamManagement: 'Team management',
  inviteCollaborator: 'Invite collaborator',
  generateInvite: 'Generate one-time invite',
  copyInvite: 'Copy invite link',
  noItems: 'None',
};

const OVERRIDES: Partial<Record<LocaleCode, Partial<ProductCopy>>> = {
  'zh-CN': {
    historyTitle: 'SOP 数字护照与版本中心',
    historySubtitle: '历史、版本、分享与协作',
    evidenceTitle: '证据档案与发布门禁',
    evidenceSubtitle: '每项判断都能回到证据引用',
    protocolTitle: '钓鱼演练与 A2MCP 协议',
    protocolSubtitle: '评审、生成、决策、版本比较四个工具',
    securityTitle: '安全、团队与审计控制台',
    securitySubtitle: '鉴权、限流、审计、滥用防护和稳定 API',
    workspaceTagline: '可追溯、可训练、可审计',
    exportReport: '导出培训报告',
    assignTraining: '分配演练',
    assignedTraining: '已分配给团队',
    sopCount: 'SOP 数量',
    publishable: '可发布',
    needsReview: '需复核',
    blocked: '已阻断',
    sopVersions: 'SOP 与版本',
    noSop: '先在指挥室提交一份 SOP，系统会自动建立数字护照。',
    createVersion: '创建新版本',
    saveReview: '保存并重新审查',
    compareVersions: '比较最近两个版本',
    copyShare: '复制分享链接',
    noHistory: '暂无 SOP 历史。',
    evidenceChain: '证据链与就绪门禁',
    evidenceSubtitleShort: '每项判断都能回到证据引用',
    protocolToolStatus: '鉴权、限流、Schema 校验与审计日志已启用。',
    phishingScenario: '钓鱼邮件响应演练',
    trainingAssigned: '团队训练已分配，结果将进入审计记录。',
    trainingWaiting: '等待分配团队训练。',
    teamManagement: '团队管理',
    inviteCollaborator: '邀请协作者',
    generateInvite: '生成一次性邀请',
    copyInvite: '复制邀请链接',
    noItems: '无',
  },
  'ar-SA': {
    historyTitle: 'جواز SOP ومركز الإصدارات',
    historySubtitle: 'السجل والإصدارات والمشاركة والتعاون',
    evidenceTitle: 'أرشيف الأدلة وبوابات النشر',
    evidenceSubtitle: 'كل قرار مرتبط بدليل موثق',
    protocolTitle: 'تدريب التصيد وبروتوكول A2MCP',
    protocolSubtitle: 'أدوات المراجعة والتوليد والقرارات ومقارنة الإصدارات',
    securityTitle: 'وحدة الأمان والفريق والتدقيق',
    securitySubtitle: 'المصادقة والحدود والسجل وحماية إساءة الاستخدام',
    workspaceTagline: 'قابل للتتبع والتدريب والتدقيق',
    exportReport: 'تصدير تقرير التدريب',
    assignTraining: 'تعيين تمرين',
    assignedTraining: 'تم التعيين للفريق',
    sopCount: 'عدد SOP',
    publishable: 'قابل للنشر',
    needsReview: 'يحتاج مراجعة',
    blocked: 'محظور',
    sopVersions: 'SOP والإصدارات',
    noSop: 'أرسل SOP من غرفة القيادة لإنشاء جوازه الرقمي.',
    createVersion: 'إنشاء إصدار جديد',
    saveReview: 'حفظ وإعادة المراجعة',
    compareVersions: 'مقارنة أحدث الإصدارات',
    copyShare: 'نسخ رابط المشاركة',
    noHistory: 'لا يوجد سجل SOP بعد.',
    evidenceChain: 'سلسلة الأدلة وبوابات الجاهزية',
    evidenceSubtitleShort: 'كل نتيجة مرتبطة بمصدر موثق',
    protocolToolStatus: 'المصادقة والحدود والتحقق والسجل مفعلة.',
    phishingScenario: 'تمرين الاستجابة لبريد تصيد',
    trainingAssigned: 'تم تعيين تدريب الفريق وسيظهر في سجل التدقيق.',
    trainingWaiting: 'بانتظار تعيين تدريب الفريق.',
    teamManagement: 'إدارة الفريق',
    inviteCollaborator: 'دعوة متعاون',
    generateInvite: 'إنشاء دعوة لمرة واحدة',
    copyInvite: 'نسخ رابط الدعوة',
    noItems: 'لا شيء',
  },
  'ja-JP': {
    historyTitle: 'SOP パスポートと版管理',
    historySubtitle: '履歴、版、共有、共同作業',
    evidenceTitle: '証拠アーカイブと公開ゲート',
    evidenceSubtitle: 'すべての判断を証拠へ追跡',
    protocolTitle: 'フィッシング演習と A2MCP',
    protocolSubtitle: 'レビュー、生成、判断、版比較',
    securityTitle: 'セキュリティ・チーム・監査',
    securitySubtitle: '認証、制限、監査、濫用対策、安定 API',
    workspaceTagline: '追跡可能・訓練可能・監査可能',
    exportReport: '訓練レポートを出力',
    assignTraining: '演習を割り当て',
    assignedTraining: 'チームに割り当て済み',
    sopCount: 'SOP 数',
    publishable: '公開可能',
    needsReview: '要レビュー',
    blocked: 'ブロック',
    sopVersions: 'SOP と版',
    noSop: '指揮室から SOP を送信するとデジタルパスポートが作成されます。',
    createVersion: '新しい版を作成',
    saveReview: '保存して再レビュー',
    compareVersions: '最新版を比較',
    copyShare: '共有リンクをコピー',
    noHistory: 'SOP 履歴はありません。',
    evidenceChain: '証拠チェーンと準備ゲート',
    evidenceSubtitleShort: '各判断を引用元へ追跡',
    protocolToolStatus: '認証、制限、Schema 検証、監査ログが有効です。',
    phishingScenario: 'フィッシングメール対応演習',
    trainingAssigned: 'チーム訓練を割り当て、監査ログに記録します。',
    trainingWaiting: 'チーム訓練の割り当てを待っています。',
    teamManagement: 'チーム管理',
    inviteCollaborator: '共同作業者を招待',
    generateInvite: '一回限りの招待を作成',
    copyInvite: '招待リンクをコピー',
    noItems: 'なし',
  },
};

export function getProductCopy(locale: LocaleCode): ProductCopy {
  return { ...EN, ...(OVERRIDES[locale] ?? {}) };
}
