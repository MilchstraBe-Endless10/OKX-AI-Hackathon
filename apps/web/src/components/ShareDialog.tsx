import { useState, useRef } from 'react';
import { productApi, type CreateShareResponse } from '../lib/product-api';

interface ShareDialogProps {
  rehearsalId: string;
  onClose: () => void;
  onShareCreated?: (share: CreateShareResponse) => void;
}

export default function ShareDialog({ rehearsalId, onClose, onShareCreated }: ShareDialogProps) {
  const [expiresIn, setExpiresIn] = useState<'7d' | '30d' | 'never'>('7d');
  const [maxViews, setMaxViews] = useState<-1 | 10 | 50 | 100>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdShare, setCreatedShare] = useState<CreateShareResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function createShare() {
    setLoading(true);
    setError(null);
    try {
      const expiresAt =
        expiresIn === 'never'
          ? null
          : new Date(
              Date.now() + (expiresIn === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000,
            ).toISOString();
      const share = await productApi.createShare(rehearsalId, expiresAt, maxViews);
      setCreatedShare(share);
      onShareCreated?.(share);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建分享失败');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (createdShare && inputRef.current) {
      inputRef.current.select();
      navigator.clipboard.writeText(createdShare.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="share-overlay" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="share-card">
        <span>SHARE · 安全分享</span>
        <h2 id="share-title">分享演练报告</h2>
        <p>生成一个只读链接，无需登录即可查看本次演练结果。</p>

        {createdShare ? (
          <div className="share-result">
            <label>
              <span>分享链接</span>
              <input
                ref={inputRef}
                type="text"
                readOnly
                value={createdShare.shareUrl}
                className="share-url"
              />
            </label>
            <div className="share-info">
              <i>
                过期时间: {expiresIn === 'never' ? '永久' : expiresIn === '7d' ? '7 天' : '30 天'}
              </i>
              <i>最大查看: {maxViews === -1 ? '无限制' : maxViews + ' 次'}</i>
            </div>
            <button onClick={copyLink} className={copied ? 'copied' : ''}>
              {copied ? '✓ 已复制' : '复制链接'}
            </button>
            <button onClick={onClose} className="secondary">
              关闭
            </button>
          </div>
        ) : (
          <>
            <label>
              <span>过期时间</span>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value as '7d' | '30d' | 'never')}
              >
                <option value="7d">7 天</option>
                <option value="30d">30 天</option>
                <option value="never">永久</option>
              </select>
            </label>
            <label>
              <span>最大查看次数</span>
              <select
                value={maxViews}
                onChange={(e) => setMaxViews(Number(e.target.value) as -1 | 10 | 50 | 100)}
              >
                <option value={-1}>无限制</option>
                <option value={10}>10 次</option>
                <option value={50}>50 次</option>
                <option value={100}>100 次</option>
              </select>
            </label>
            {error && <div className="product-alert">{error}</div>}
            <button onClick={createShare} disabled={loading}>
              {loading ? '创建中...' : '创建分享'}
            </button>
            <button onClick={onClose} className="secondary" disabled={loading}>
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
