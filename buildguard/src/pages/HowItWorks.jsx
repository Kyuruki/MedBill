import { Container, Eyebrow, Button, Callout } from "../components/ui.jsx";
import { STEPS } from "../content.js";

export default function HowItWorks() {
  return (
    <Container as="article" className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">From photo to dispute letter</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          MedBill Analyzer runs a simple, transparent pipeline. No AI decides what your charges should have been. The
          numbers come from your bill and from official CMS fee schedules.
        </p>
      </div>

      <ol className="mt-12 space-y-10 border-l border-line pl-6 sm:pl-8">
        {STEPS.map((step) => (
          <li key={step.n} className="relative">
            <span
              className="absolute -left-[calc(1.5rem+1px)] flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-paper font-mono text-xs font-semibold text-brand-700 sm:-left-[calc(2rem+1px)]"
              aria-hidden="true"
            >
              {step.n}
            </span>
            <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line p-6">
          <h2 className="text-base font-semibold text-ink">The two CMS fee schedules</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Codes are checked against the <strong className="font-semibold text-ink">Physician Fee Schedule</strong>{" "}
            (office visits, imaging, procedures) and, if not found there, the{" "}
            <strong className="font-semibold text-ink">Clinical Laboratory Fee Schedule</strong> (labs, venipuncture).
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line p-6">
          <h2 className="text-base font-semibold text-ink">Codes we can't confirm</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            If a code isn't in either schedule, it's marked <strong className="font-semibold text-ink">Unverified</strong>:
            shown for completeness, never compared to a rate we don't have.
          </p>
        </div>
      </div>

      <Callout tone="neutral" className="mt-10 max-w-3xl">
        Medicare reference rates are a benchmark, not a cap on what a provider may bill or what you ultimately owe.
        Negotiated rates, facility costs, and your plan all vary, so treat a flag as a prompt to ask questions.
      </Callout>

      <div className="mt-10">
        <Button to="/analyze" size="lg">Analyze a bill</Button>
      </div>
    </Container>
  );
}
