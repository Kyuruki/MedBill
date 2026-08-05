import { Container, Eyebrow, Button } from "../components/ui.jsx";
import LedgerDemo from "../components/LedgerDemo.jsx";
import { STEPS } from "../content.js";

export default function Home() {
  return (
    <>
      {/* Hero: billed vs. Medicare reference, reconciled. */}
      <section aria-labelledby="hero-heading" className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Eyebrow>Medical bill review</Eyebrow>
            <h1 id="hero-heading" className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              See how your medical bill{" "}
              <span className="text-brand-700">compares to Medicare.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Upload a bill and MedBill Analyzer checks every billing code against official CMS Medicare reference rates,
              showing what each charge works out to as a multiple of the benchmark. If any are far above it, it drafts a
              letter requesting a review.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button to="/analyze" size="lg">Analyze a bill</Button>
              <Button to="/how-it-works" variant="secondary" size="lg">How it works</Button>
            </div>
            <p className="mt-6 font-mono text-xs text-muted">
              No account · nothing stored · reads in memory and discards
            </p>
          </div>

          <div className="lg:pl-4">
            <LedgerDemo />
          </div>
        </Container>
      </section>

      {/* Process: the four steps, in order. */}
      <section aria-labelledby="process-heading">
        <Container className="py-16 sm:py-20">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="process-heading" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink">
            Four steps, no guesswork
          </h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="font-mono text-sm font-semibold text-brand-600" aria-hidden="true">{step.n}</span>
                <div className="mt-3 h-px w-8 bg-brand-200" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why the benchmark matters. */}
      <section aria-labelledby="why-heading" className="border-y border-line bg-paper-2">
        <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>Why Medicare rates</Eyebrow>
            <h2 id="why-heading" className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              A public benchmark for a private number
            </h2>
          </div>
          <div className="space-y-4 text-ink-soft">
            <p className="leading-relaxed">
              CMS publishes standardized rates for medical procedures. They're a widely used reference for what care
              actually costs, which makes them a fair yardstick for a charge with no context.
            </p>
            <p className="leading-relaxed">
              MedBill Analyzer only compares codes it can confirm in the CMS data, and never puts a number on a charge it
              can't verify. Most US charges sit above the benchmark, so a multiple isn't an accusation. A large one is a
              reason to ask for an itemized justification.
            </p>
            <p>
              <Button to="/faq" variant="ghost" className="-ml-2">Read the FAQ →</Button>
            </p>
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <section aria-labelledby="cta-heading">
        <Container className="py-16 text-center sm:py-24">
          <h2 id="cta-heading" className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Got a bill that looks too high?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
            Check it in under a minute. It's free, anonymous, and nothing you upload is stored.
          </p>
          <div className="mt-8">
            <Button to="/analyze" size="lg">Analyze a bill</Button>
          </div>
        </Container>
      </section>
    </>
  );
}
