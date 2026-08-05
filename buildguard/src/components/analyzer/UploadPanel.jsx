import { useId, useRef, useState } from "react";
import { Button } from "../ui.jsx";

const ACCEPT = "image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf";

// Accessible upload: a real <input type="file"> with a <label> dropzone. Keyboard
// and screen-reader users operate the input directly; pointer users can also drag.
export default function UploadPanel({ file, onFile, onAnalyze, analyzing }) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  }

  return (
    <div>
      {/* Input first so Tailwind `peer-*` on the label can reflect its focus state. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        aria-describedby={hintId}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center transition-[color,background-color,border-color]",
          dragging ? "border-brand-500 bg-brand-50" : "border-line bg-paper-2 hover:border-brand-200",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="mb-3 h-9 w-9 text-brand-600" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M12 15V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-base font-semibold text-ink">
          {file ? "Choose a different file" : "Drag a bill here, or choose a file"}
        </span>
        <span id={hintId} className="mt-1 text-sm text-muted">
          PNG, JPEG, or PDF · up to 4 MB · PDFs up to 30 pages
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" size="lg" onClick={onAnalyze} disabled={!file || analyzing} aria-busy={analyzing}>
          {analyzing ? "Analyzing…" : "Analyze bill"}
        </Button>
        {file && (
          <p className="text-sm text-ink-soft">
            <span className="text-muted">Selected:</span>{" "}
            <span className="font-medium text-ink">{file.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
