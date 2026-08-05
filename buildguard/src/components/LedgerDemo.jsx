// A stylized fragment of an itemized statement showing the core reconciliation:
// billed vs. Medicare reference, as a multiple. It's illustrative (sample data),
// presented as a labelled figure for screen readers.

const ROWS = [
  { code: "99213", label: "Office visit, established patient", billed: 250.0, ref: 91.0 },
  { code: "80053", label: "Comprehensive metabolic panel", billed: 210.0, ref: 11.6 },
  { code: "36415", label: "Routine venipuncture", billed: 22.0, ref: 3.0 },
];

const money = (n) => `$${n.toFixed(2)}`;
const MAX_MULTIPLE = Math.max(...ROWS.map((r) => r.billed / r.ref));

export default function LedgerDemo() {
  return (
    <figure className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-[0_1px_0_rgba(10,37,64,0.04),0_18px_40px_-24px_rgba(10,37,64,0.35)]">
      <div className="flex items-center justify-between border-b border-line bg-paper-2 px-5 py-3">
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-brand-700">
          Statement review
        </span>
        <span className="font-mono text-xs text-muted">sample</span>
      </div>

      <div className="px-3 py-1 sm:px-5 sm:py-2">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Example bill review comparing billed charges to CMS Medicare reference rates.
          </caption>
          <thead>
            <tr className="text-[0.7rem] uppercase tracking-wider text-muted">
              <th scope="col" className="py-2 pr-2 font-medium">Code</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Charged</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Medicare</th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">vs. reference</th>
            </tr>
          </thead>
          <tbody className="tnums font-mono text-sm">
            {ROWS.map((r) => {
              const mult = r.billed / r.ref;
              return (
                <tr key={r.code} className="border-t border-line/70 align-top">
                  <th scope="row" className="py-3 pr-2 font-normal">
                    <span className="font-semibold text-ink">{r.code}</span>
                    <span className="mt-0.5 block max-w-[16ch] truncate font-sans text-xs text-muted">{r.label}</span>
                  </th>
                  <td className="py-3 pr-2 text-right text-ink">{money(r.billed)}</td>
                  <td className="py-3 pr-2 text-right text-ink-soft">{money(r.ref)}</td>
                  <td className="py-3 pl-2 text-right">
                    <span className={mult >= 5 ? "font-semibold text-flag" : "font-semibold text-ink"}>
                      {mult.toFixed(1)}×
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <figcaption className="flex items-center justify-between border-t border-line bg-paper-2 px-5 py-3 text-sm">
        <span className="font-medium text-ink">Highest vs. reference</span>
        <span className="tnums font-mono font-semibold text-flag">{MAX_MULTIPLE.toFixed(1)}×</span>
      </figcaption>
    </figure>
  );
}
