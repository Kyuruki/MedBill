import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultsTable from "../src/components/analyzer/ResultsTable.jsx";

// The status bands are the product's whole verdict: < 2x Near, 2-5x Above, >= 5x Far
// above, and Unverified when the code is not in a CMS table (CLAUDE.md, "Framing").
const item = (code, multiple, found = true) => ({
  code,
  charged: 100,
  found_in_fee_schedule: found,
  medicare_rate: found ? 100 / multiple : null,
  overcharge_multiple: found ? multiple : null,
});

function statuses(lineItems) {
  const html = renderToStaticMarkup(
    <ResultsTable lineItems={lineItems} summary={{ totalCharged: 0, maxMultiple: 0, verifiedCount: 0, total: 0 }} />,
  );
  return [...html.matchAll(/<tr[^>]*>.*?<\/tr>/g)]
    .slice(1) // header row
    .map((row) => row[0].match(/(Far above reference|Above reference|Near reference|Unverified)/)[1]);
}

describe("ResultsTable status bands", () => {
  it.each([
    [1.0, "Near reference"],
    [1.99, "Near reference"],
    [2.0, "Above reference"],
    [4.99, "Above reference"],
    [5.0, "Far above reference"],
    [42, "Far above reference"],
  ])("%sx is %s", (multiple, label) => {
    expect(statuses([item("99213", multiple)])).toEqual([label]);
  });

  it("a code missing from both fee schedules is Unverified, never banded", () => {
    expect(statuses([item("99999", 9, false)])).toEqual(["Unverified"]);
  });

  it("an unverified row shows no rate or multiple", () => {
    const html = renderToStaticMarkup(
      <ResultsTable lineItems={[item("99999", 9, false)]} summary={{ totalCharged: 100, maxMultiple: 0, verifiedCount: 0, total: 1 }} />,
    );
    expect(html).not.toContain("×</span>");
    expect(html).toContain("0 / 1");
  });

  it("renders the empty state instead of a table when nothing was extracted", () => {
    const html = renderToStaticMarkup(<ResultsTable lineItems={[]} summary={{}} />);
    expect(html).toContain("No billing line items found");
    expect(html).not.toContain("<table");
  });
});
