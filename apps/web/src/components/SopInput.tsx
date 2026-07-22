import { useState, type FormEvent } from 'react';
import { SopInputSchema, type SopInput as SopInputValue } from '@sopscape/contracts';

const MAX_CONTENT_BYTES = 60_000;

interface SopInputProps {
  onSubmit: (input: SopInputValue) => void;
}

export default function SopInput({ onSubmit }: SopInputProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const parsed = SopInputSchema.safeParse({
      title: title.trim(),
      content,
      locale: 'zh-CN',
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid SOP input');
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
      <h2 className="text-base font-semibold text-slate-100">Submit SOP</h2>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Phishing Email Response SOP"
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
        <span className="text-sm text-slate-300">SOP Content</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your SOP text here…"
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
            {byteLen.toLocaleString()} / {MAX_CONTENT_BYTES.toLocaleString()} bytes
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
        Start Rehearsal
      </button>
    </form>
  );
}
