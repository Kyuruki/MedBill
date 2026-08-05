import { Container, Eyebrow, Callout } from "../components/ui.jsx";
import { CONTACT_EMAIL, PROCESSORS } from "../content.js";

// This page doubles as the Consumer Health Data Privacy Policy required by
// Washington's My Health My Data Act (RCW 19.373.020) and Nevada SB 370. Those
// statutes have no revenue or volume threshold, so they apply to this project at any
// size, and MHMDA carries a private right of action. The required elements are: the
// categories collected, the purposes, the sources, the categories shared, a list of
// the categories of third parties, and a stated mechanism for the rights in
// RCW 19.373.040. Keep all six present if you edit this.

function Section({ title, id, children }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <Container as="article" className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Consumer Health Data Privacy Policy
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          A medical bill is health data, so this page says exactly what happens to yours: what is read, why, who
          touches it, and what you can ask for. The short version is that your bill is processed in memory and
          discarded when the request finishes.
        </p>
        <p className="mt-3 text-sm text-muted">Last updated 4 August 2026.</p>
      </div>

      <div className="max-w-3xl">
        <Section id="what" title="What we collect, and where it comes from">
          <p>
            Everything below comes from one source: <strong className="font-semibold text-ink">the file you choose
            to upload</strong>, plus anything you type into the letter form. Nothing is gathered from data brokers,
            advertisers, your browser history, or any other third party, and there is no tracking or analytics on
            this site.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="font-semibold text-ink">Consumer health data</strong> — the bill image or PDF, the
              text read from it, and the billing codes and dollar amounts extracted. Billing codes can indicate the
              procedures you had, which is why this page exists.
            </li>
            <li>
              <strong className="font-semibold text-ink">What you type</strong> — an optional patient name and
              provider name for the letter. You can leave both blank and the letter uses placeholders.
            </li>
            <li>
              <strong className="font-semibold text-ink">Your IP address</strong> — seen in transit by the host, and
              used only to enforce rate limits, as described below.
            </li>
          </ul>
        </Section>

        <Section id="why" title="Why we collect it">
          <p>
            Only to do the thing you asked for: read the codes off your bill, compare each one to published CMS
            Medicare reference rates, and if you request it, draft a letter. There is no secondary purpose. Your
            data is never sold, never shared for advertising, never used to train a model, and never used to build
            a profile of you.
          </p>
        </Section>

        <Section id="retention" title="What is kept, and for how long">
          <p>
            Your bill and everything derived from it are held in memory for the seconds the request takes, then
            discarded. They are never written to disk or to a database. There are no accounts and no history, so
            there is nothing to log into and nothing accumulating about you.
          </p>
          <p>
            <strong className="font-semibold text-ink">One exception, in the interest of being straight with
            you:</strong> to stop one person from flooding the service, we keep a short-lived counter of how many
            requests an address has made. The address itself is not stored. It is put through a keyed one-way hash
            first, so the stored value cannot be turned back into your IP address by anyone who obtains the
            database. Those counters expire on their own and are deleted. They are not linked to your bill, its
            contents, or anything else about you.
          </p>
        </Section>

        <Section id="who" title="Who processes your data">
          <p>
            The service is built on these providers. They act as processors, handling data only to run this site —
            none of them receives it for their own purposes, and no data is sold or shared with advertisers,
            insurers, providers, or data brokers.
          </p>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Third parties that process data for MedBill Analyzer, what each does, and what it receives.
              </caption>
              <thead>
                <tr className="border-b border-line bg-paper-2 text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Provider</th>
                  <th scope="col" className="px-4 py-3 font-medium">What it does</th>
                  <th scope="col" className="px-4 py-3 font-medium">What it receives</th>
                </tr>
              </thead>
              <tbody>
                {PROCESSORS.map((p) => (
                  <tr key={p.name}>
                    <th scope="row" className="border-t border-line px-4 py-3 font-semibold text-ink">{p.name}</th>
                    <td className="border-t border-line px-4 py-3 text-ink-soft">{p.role}</td>
                    <td className="border-t border-line px-4 py-3 text-ink-soft">{p.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The letter step is the only one that sends anything to an AI service, it only happens if you press the
            button, and it sends figures rather than your bill. If you would rather not involve a third party at
            all, stop after the results table and write your own letter.
          </p>
        </Section>

        <Section id="rights" title="Your rights, and how to use them">
          <p>
            You have the right to know what consumer health data we have about you, to get a copy of it, to have it
            deleted, and to withdraw consent to its collection. You also have the right not to be discriminated
            against for exercising any of these.
          </p>
          <p>
            Email{" "}
            <a className="font-medium text-brand-700 underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{" "}
            to make any of those requests, or to appeal if one is refused.
          </p>
          <p>
            In practice the honest answer will almost always be that we hold nothing about you: there are no
            accounts, and your bill was discarded when the request ended, so there is no record to look up, copy,
            or delete. To withdraw consent, simply stop uploading bills. Nothing is retained that would survive
            that.
          </p>
        </Section>

        <Section id="scope" title="What this service is not">
          <p>
            MedBill Analyzer is not a healthcare provider, health plan, or clearinghouse, and it is not acting on
            behalf of one. It is therefore not covered by HIPAA, and the protections described here come from this
            policy and from the design of the service rather than from HIPAA.
          </p>
        </Section>

        <Callout tone="warn" title="Informational only" className="mt-10">
          MedBill Analyzer is not legal, medical, or financial advice, and is not affiliated with CMS, Medicare, or any
          insurer. Medicare reference rates are a benchmark, not a statement of what you owe. Verify against your own
          bill and plan before acting.
        </Callout>
      </div>
    </Container>
  );
}
