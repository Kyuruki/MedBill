import { useMemo, useState } from "react";
import { Container, Eyebrow, Callout } from "../components/ui.jsx";
import UploadPanel from "../components/analyzer/UploadPanel.jsx";
import ResultsTable from "../components/analyzer/ResultsTable.jsx";
import LetterPanel from "../components/analyzer/LetterPanel.jsx";
import { DISCLAIMER } from "../content.js";

// Vercel rejects request bodies over 4.5 MB before our function runs, so this one is a
// plain-text platform error, not our JSON — parsing it as JSON is why oversized uploads
// used to surface as a generic "please try again".
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const TOO_LARGE_MESSAGE =
  "That file is too large to upload (the limit is 4 MB). Phone photos are often bigger than this: try screenshotting the bill, or scanning it to PDF.";

async function readError(response, fallback) {
  if (response.status === 413) return TOO_LARGE_MESSAGE;
  const body = await response.json().catch(() => null);
  return body?.detail || fallback;
}

export default function Analyzer() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [result, setResult] = useState(null);

  const [patientName, setPatientName] = useState("");
  const [providerName, setProviderName] = useState("");
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState(null);
  const [letter, setLetter] = useState(null);

  const lineItems = useMemo(() => result?.line_items ?? [], [result]);

  const summary = useMemo(() => {
    const overcharged = lineItems.filter((li) => li.found_in_fee_schedule && li.overcharge_amount > 0);
    return {
      total: lineItems.length,
      verifiedCount: lineItems.filter((li) => li.found_in_fee_schedule).length,
      totalCharged: lineItems.reduce((s, li) => s + (li.charged || 0), 0),
      // No summed "total overcharge": nearly every US charge sits above the Medicare
      // reference rate, so summing the gap reads as money owed back when it isn't.
      // The highest multiple is the number that actually says something.
      maxMultiple: overcharged.reduce((m, li) => Math.max(m, li.overcharge_multiple || 0), 0),
      overchargedCount: overcharged.length,
    };
  }, [lineItems]);

  function handleFile(next) {
    setAnalyzeError(next && next.size > MAX_UPLOAD_BYTES ? TOO_LARGE_MESSAGE : null);
    setFile(next);
  }

  async function handleAnalyze() {
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setAnalyzeError(TOO_LARGE_MESSAGE);
      return;
    }
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
    setLetter(null);
    setLetterError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!response.ok) throw new Error(await readError(response, "We couldn't analyze this bill. Please try again."));
      setResult(await response.json());
    } catch (err) {
      setAnalyzeError(err.message || "Something went wrong. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerateLetter() {
    if (summary.overchargedCount === 0) return;
    setLetterLoading(true);
    setLetterError(null);
    setLetter(null);
    try {
      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_items: lineItems,
          patient_name: patientName || null,
          provider_name: providerName || null,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "We couldn't generate the letter. Please try again."));
      const data = await response.json();
      if (data.letter) setLetter(data.letter);
      else setLetterError(data.message || "No letter was generated.");
    } catch (err) {
      setLetterError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLetterLoading(false);
    }
  }

  return (
    <Container as="section" className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Analyzer</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Check a medical bill</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          Upload an itemized bill. We'll read the codes and show what each charge works out to as a multiple of the CMS
          Medicare reference rate, then draft a letter requesting a review if any sit well above it.
        </p>
      </div>

      <Callout tone="info" className="mt-6 max-w-2xl">
        {DISCLAIMER}
      </Callout>

      <div className="mt-8 max-w-2xl">
        <UploadPanel file={file} onFile={handleFile} onAnalyze={handleAnalyze} analyzing={analyzing} />

        <div aria-live="polite" className="mt-3 text-sm text-ink-soft empty:hidden">
          {analyzing
            ? "Analyzing your bill…"
            : result
              ? `Analysis complete: ${summary.total} line item${summary.total === 1 ? "" : "s"}, ${summary.verifiedCount} checked against CMS rates.`
              : ""}
        </div>
        <div aria-live="assertive" role="alert" className="mt-3 empty:hidden">
          {analyzeError && <p className="text-sm font-medium text-flag">{analyzeError}</p>}
        </div>
      </div>

      {result && (
        <div className="mt-12 space-y-10">
          <ResultsTable lineItems={lineItems} summary={summary} />
          {summary.total > 0 && (
          <LetterPanel
            canGenerate={summary.overchargedCount > 0}
            patientName={patientName}
            providerName={providerName}
            onPatient={setPatientName}
            onProvider={setProviderName}
            onGenerate={handleGenerateLetter}
            loading={letterLoading}
            letter={letter}
            error={letterError}
          />
          )}
        </div>
      )}
    </Container>
  );
}
