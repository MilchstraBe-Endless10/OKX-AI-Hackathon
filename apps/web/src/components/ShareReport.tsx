import { useEffect, useState } from 'react';
import { productApi, type SharedRehearsal } from '../lib/product-api';

export default function ShareReport() {
  const pathMatch = window.location.pathname.match(/^\/r\/([a-zA-Z0-9_-]+)$/);
  const token = pathMatch ? pathMatch[1] : null;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedRehearsal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('缺少分享令牌');
      setLoading(false);
      return;
    }

    productApi
      .getSharedRehearsal(token)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : '加载分享失败');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="share-report-page">
        <div className="share-report-container">
          <div className="share-report-header">
            <h1>SOPscape 演练报告</h1>
          </div>
          <div className="share-report-section">
            <p style={{ textAlign: 'center', color: 'var(--muted)' }}>加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="share-report-page">
        <div className="share-report-container">
          <div className="share-report-header">
            <h1>SOPscape 演练报告</h1>
          </div>
          <div className="share-report-section">
            <p style={{ textAlign: 'center', color: 'var(--danger)' }}>
              {error || '分享不存在、已过期或达到查看次数上限'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const consensusScore = data.council.consensus.length
    ? Math.round(
        (data.council.consensus.reduce((sum, finding) => sum + finding.confidence, 0) /
          data.council.consensus.length) *
          100,
      )
    : 0;

  const totalScore = data.decisions.reduce((sum, d) => sum + d.scoreDelta, 0);
  const finalScore = Math.max(0, Math.min(100, 50 + totalScore));
  const unsafeCount = data.decisions.filter((d) => d.scoreDelta < 0).length;

  return (
    <div className="share-report-page">
      <div className="share-report-container">
        <div className="share-report-header">
          <div>
            <h1>SOPscape 演练报告</h1>
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
              只读分享 · {new Date(data.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
          <span className="share-report-badge">只读</span>
        </div>

        {/* 演练概览 */}
        <div className="share-report-section">
          <h2>演练概览</h2>
          <div className="share-report-item">
            <span className="share-report-label">演练 ID</span>
            <span className="share-report-value">{data.rehearsalId.slice(0, 8)}...</span>
          </div>
          <div className="share-report-item">
            <span className="share-report-label">共识强度</span>
            <span className="share-report-value">{consensusScore}%</span>
          </div>
          <div className="share-report-item">
            <span className="share-report-label">建议路径节点</span>
            <span className="share-report-value">{data.council.recommendedPath.length} 个</span>
          </div>
          <div className="share-report-item">
            <span className="share-report-label">决策节点</span>
            <span className="share-report-value">{data.council.decisionNodes.length} 个</span>
          </div>
          <div className="share-report-item">
            <span className="share-report-label">证据缺口</span>
            <span className="share-report-value">{data.council.evidenceGaps.length} 个</span>
          </div>
        </div>

        {/* 决策记录 */}
        {data.decisions.length > 0 && (
          <div className="share-report-section">
            <h2>决策记录 ({data.decisions.length})</h2>
            {data.decisions.map((decision, index) => {
              const isSafe = decision.scoreDelta >= 0;
              return (
                <div key={index} className="share-report-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>决策 #{index + 1}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {decision.consequence}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      className={`share-risk-${
                        decision.riskLevel === 'high'
                          ? 'high'
                          : decision.riskLevel === 'medium'
                            ? 'medium'
                            : 'low'
                      }`}
                      style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}
                    >
                      {decision.riskLevel === 'high'
                        ? '高风险'
                        : decision.riskLevel === 'medium'
                          ? '中风险'
                          : '低风险'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: isSafe ? 'var(--green)' : 'var(--danger)',
                      }}
                    >
                      {decision.scoreDelta > 0 ? '+' : ''}
                      {decision.scoreDelta} 分
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 最终评分 */}
        {data.decisions.length > 0 && (
          <div className="share-report-section">
            <h2>最终评分</h2>
            <div className="share-report-item">
              <span className="share-report-label">完成节点</span>
              <span className="share-report-value">
                {data.decisions.length} / {data.council.decisionNodes.length}
              </span>
            </div>
            <div className="share-report-item">
              <span className="share-report-label">风险选择</span>
              <span className="share-report-value share-risk-high">{unsafeCount} 个</span>
            </div>
            <div className="share-report-item">
              <span className="share-report-label">总分</span>
              <span
                className="share-report-value"
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: finalScore >= 70 ? 'var(--green)' : 'var(--amber)',
                }}
              >
                {finalScore}/100
              </span>
            </div>
            <div className="share-report-item">
              <span className="share-report-label">评定</span>
              <span
                className="share-report-value"
                style={{
                  color: finalScore >= 70 && unsafeCount === 0 ? 'var(--green)' : 'var(--amber)',
                  fontWeight: '600',
                }}
              >
                {finalScore >= 70 && unsafeCount === 0 ? '通过' : '需要复查'}
              </span>
            </div>
          </div>
        )}

        {/* 护照信息 */}
        <div className="share-report-section">
          <h2>SOP 护照</h2>
          <div className="share-report-item">
            <span className="share-report-label">就绪状态</span>
            <span
              className="share-report-value"
              style={{
                color:
                  data.passport.verdict === 'READY'
                    ? 'var(--green)'
                    : data.passport.verdict === 'WARN'
                      ? 'var(--amber)'
                      : 'var(--red)',
                fontWeight: '600',
              }}
            >
              {data.passport.verdict === 'READY'
                ? '就绪'
                : data.passport.verdict === 'WARN'
                  ? '警告'
                  : '阻止'}
            </span>
          </div>
          <div className="share-report-item">
            <span className="share-report-label">版本</span>
            <span className="share-report-value">v{data.passport.version}</span>
          </div>
          <div className="share-report-item">
            <span className="share-report-label">生成时间</span>
            <span className="share-report-value">
              {new Date(data.passport.generatedAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>

        {/* 共识发现 */}
        {data.council.consensus.length > 0 && (
          <div className="share-report-section">
            <h2>专家共识 ({data.council.consensus.length})</h2>
            {data.council.consensus.map((finding, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  background: 'rgba(102, 230, 173, 0.05)',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  {finding.role} · 置信度 {Math.round(finding.confidence * 100)}%
                </div>
                <div style={{ fontSize: '13px' }}>{finding.claim}</div>
              </div>
            ))}
          </div>
        )}

        {/* 页脚 */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '32px',
            color: 'var(--muted)',
            fontSize: '12px',
          }}
        >
          <p>本报告由 SOPscape 生成 · 只读分享</p>
          <p style={{ marginTop: '4px' }}>
            {data.sopId ? `SOP ID: ${data.sopId.slice(0, 8)}...` : '无关联 SOP'}
          </p>
        </div>
      </div>
    </div>
  );
}
