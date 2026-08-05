const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function StatusBadge({ status }) {
  const map = {
    far: { label: "Far above reference", cls: "bg-flag-bg text-flag" },
    above: { label: "Above reference", cls: "bg-warn-bg text-warn" },
    near: { label: "Near reference", cls: "bg-ok-bg text-ok" },
    unverified: { label: "Unverified", cls: "bg-warn-bg text-warn" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span aria-hidden="true" className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// Commercial rates commonly run 2-3x Medicare and that is ordinary and lawful, so
// "above the reference rate" is not by itself a finding. The bands mark where a charge
// stops being ordinary: ~2x is the usual reasonable-charge line, 5x and up is an outlier.
function rowStatus(li) {
  if (!li.found_in_fee_schedule) return "unverified";
  const multiple = li.overcharge_multiple || 0;
  if (multiple >= 5) return "far";
  if (multiple >= 2) return "above";
  return "near";
}

// A summary stat. The overcharge one is emphasized when money is at stake.
function Stat({ label, value, tone = "ink" }) {
  const tones = { ink: "text-ink", flag: "text-flag" };
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`tnums mt-1 font-mono text-2xl font-semibold ${tones[tone]}`}>{value}</dd>
    </div>
  );
}

export default function ResultsTable({ lineItems, summary }) {
  if (!lineItems.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-paper-2 p-6 text-center">
        <p className="font-semibold text-ink">No billing line items found</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
          We couldn't read any lines with both a 5-digit code and a dollar amount. A clearer, well-lit photo of the
          itemized statement (not the summary page) usually reads better.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-[var(--radius-card)] border border-line bg-paper-2 p-5 sm:grid-cols-3">
        <Stat label="Total charged" value={money(summary.totalCharged)} />
        <Stat
          label="Highest vs. reference"
          value={summary.maxMultiple ? `${summary.maxMultiple.toFixed(1)}×` : "-"}
          tone={summary.maxMultiple >= 5 ? "flag" : "ink"}
        />
        <Stat label="Codes we could check" value={`${summary.verifiedCount} / ${summary.total}`} />
      </dl>

      {/* Scrollable on narrow screens; the region is keyboard-focusable so it can be scrolled. */}
      <div
        role="region"
        aria-label="Line items compared to CMS Medicare reference rates"
        tabIndex={0}
        className="overflow-x-auto rounded-[var(--radius-card)] border border-line"
      >
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">
            Each billing code with the amount charged, the CMS Medicare reference rate, the charge as a multiple of that
            rate, and its status.
          </caption>
          <thead>
            <tr className="border-b border-line bg-paper-2 text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Code</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Charged</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Medicare</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">vs. reference</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="tnums font-mono text-sm">
            {lineItems.map((li, i) => {
              const status = rowStatus(li);
              return (
                <tr key={i} className={status === "far" ? "bg-flag-bg/40" : ""}>
                  <th scope="row" className="border-t border-line px-4 py-3 font-semibold text-ink">{li.code}</th>
                  <td className="border-t border-line px-4 py-3 text-right text-ink">{money(li.charged)}</td>
                  <td className="border-t border-line px-4 py-3 text-right text-ink-soft">
                    {li.medicare_rate != null ? money(li.medicare_rate) : "-"}
                  </td>
                  <td className="border-t border-line px-4 py-3 text-right">
                    {li.overcharge_multiple != null ? (
                      <span className={status === "far" ? "font-semibold text-flag" : "text-ink"}>
                        {li.overcharge_multiple}×
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="border-t border-line px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
