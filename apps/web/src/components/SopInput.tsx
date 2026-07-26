import { useState, type FormEvent } from 'react';
import { SopInputSchema, type SopInput as SopInputValue } from '@sopscape/contracts';
import { getMessages, type AppMessages, type LocaleCode } from '../lib/preferences';
import { productApi } from '../lib/product-api';

const MAX_CONTENT_BYTES = 60_000;

interface SopInputProps {
  onSubmit: (input: SopInputValue) => void;
  locale?: LocaleCode;
  messages?: AppMessages;
}

export default function SopInput({ onSubmit, locale = 'zh-CN', messages }: SopInputProps) {
  const copy = messages ?? getMessages(locale);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setValidationError(null);
    const binary = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.docx');
    if (file.size > (binary ? 5 * 1024 * 1024 : MAX_CONTENT_BYTES)) {
      setValidationError(
        `文件超过 ${binary ? '5 MiB' : `${MAX_CONTENT_BYTES.toLocaleString()} 字节`}限制`,
      );
      return;
    }
    try {
      const imported = binary ? await productApi.convertDocument(file) : await file.text();
      setTitle((current) => current || file.name.replace(/\.[^.]+$/, ''));
      setContent(imported);
    } catch (reason) {
      setValidationError(reason instanceof Error ? reason.message : '文档解析失败');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const parsed = SopInputSchema.safeParse({
      title: title.trim(),
      content,
      locale,
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? copy.inputHeading);
      return;
    }

    onSubmit(parsed.data);
  }

  const byteLen = new TextEncoder().encode(content).length;
  const bytePct = Math.min((byteLen / MAX_CONTENT_BYTES) * 100, 100);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface/90 backdrop-blur rounded-lg border border-border p-4 space-y-4"
    >
      <h2 className="text-base font-semibold text-slate-100">{copy.inputHeading}</h2>

      <label className="file-import">
        <span>{copy.importSop}</span>
        <input
          type="file"
          accept=".txt,.md,.json,.csv,.eml,.pdf,.docx,text/plain,text/markdown,message/rfc822,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => void importFile(event.target.files?.[0])}
          data-testid="sop-file"
        />
        <small>{copy.fileFormats}</small>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">{copy.title}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`${copy.title}…`}
          className="w-full px-3 py-2 bg-navy-800 border border-border rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          aria-describedby="title-help"
          maxLength={200}
          data-testid="sop-title"
        />
        <span id="title-help" className="text-xs text-slate-500">
          {title.length}/200
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">{copy.content}</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`${copy.content}…`}
          rows={8}
          className="w-full px-3 py-2 bg-navy-800 border border-border rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 resize-y"
          aria-describedby="byte-counter"
          data-testid="sop-content"
        />
        <div id="byte-counter" className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${bytePct > 90 ? 'bg-danger' : bytePct > 70 ? 'bg-caution' : 'bg-teal-500'}`}
              style={{ width: `${bytePct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {byteLen.toLocaleString()} / {MAX_CONTENT_BYTES.toLocaleString()} {copy.byteUnit}
          </span>
        </div>
      </label>

      {validationError && (
        <div
          className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2"
          role="alert"
        >
          {validationError}
        </div>
      )}

      <button
        type="submit"
        className="w-full px-4 py-2.5 bg-teal-500 text-navy-950 font-medium rounded-md hover:bg-teal-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!title.trim() || !content.trim()}
        data-testid="submit-sop"
      >
        {copy.start}
      </button>
    </form>
  );
}
