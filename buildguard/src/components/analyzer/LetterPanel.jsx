import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../ui.jsx";

function Field({ id, label, value, onChange }) {
  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label} <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus-visible:border-brand-500"
        autoComplete="off"
      />
    </div>
  );
}

export default function LetterPanel({
  canGenerate,
  patientName,
  providerName,
  onPatient,
  onProvider,
  onGenerate,
  loading,
  letter,
  error,
}) {
  const patientId = useId();
  const providerId = useId();
  const letterRef = useRef(null);
  const [copyMsg, setCopyMsg] = useState("");

  // Move focus to the letter once it's generated, so keyboard/AT users land on it.
  useEffect(() => {
    if (letter && letterRef.current) letterRef.current.focus();
  }, [letter]);

  function flash(msg) {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(""), 3000);
  }

  function copy() {
    if (!letter) return;
    if (!navigator.clipboard?.writeText) {
      flash("Couldn't copy automatically. Select the letter and copy manually.");
      return;
    }
    navigator.clipboard.writeText(letter).then(
      () => flash("Copied to clipboard"),
      () => flash("Couldn't copy automatically. Select the letter and copy manually."),
    );
  }

  function download() {
    if (!letter) return;
    const url = URL.createObjectURL(new Blob([letter], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "dispute-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="letter-heading" className="border-t border-line pt-8">
      <h2 id="letter-heading" className="text-xl font-semibold tracking-tight text-ink">
        Draft a dispute letter
      </h2>

      {!canGenerate ? (
        <p className="mt-2 text-sm text-ink-soft">
          None of the codes we could check came out above the CMS reference rate, so there's nothing here for a letter to
          argue. That isn't a verdict on the bill as a whole: anything marked Unverified wasn't checked at all.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-sm text-ink-soft">
            Add your name and the provider if you like, or leave them blank and the letter uses placeholders you can
            fill in. The letter only argues charges we verified against CMS data.
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row">
            <Field id={patientId} label="Your name" value={patientName} onChange={onPatient} />
            <Field id={providerId} label="Provider name" value={providerName} onChange={onProvider} />
          </div>

          <div className="mt-5">
            <Button type="button" size="lg" onClick={onGenerate} disabled={loading} aria-busy={loading}>
              {loading ? "Drafting…" : "Generate dispute letter"}
            </Button>
          </div>
        </>
      )}

      {/* Assertive: a letter error should interrupt. */}
      <div aria-live="assertive" role="alert" className="mt-4 empty:hidden">
        {error && <p className="text-sm font-medium text-flag">{error}</p>}
      </div>

      {letter && (
        <div className="mt-6">
          <div
            ref={letterRef}
            tabIndex={-1}
            aria-label="Generated dispute letter"
            className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-card)] border border-line bg-paper-2 p-6 text-[0.95rem] leading-relaxed text-ink"
          >
            {letter}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={copy}>Copy</Button>
            <Button type="button" variant="secondary" onClick={download}>Download .txt</Button>
            <span
              aria-live="polite"
              className={`text-sm empty:hidden ${copyMsg.startsWith("Copied") ? "text-ok" : "text-warn"}`}
            >
              {copyMsg}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted">Review and edit the letter before sending. It's a starting point you control.</p>
        </div>
      )}
    </section>
  );
}
