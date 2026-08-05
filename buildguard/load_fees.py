"""Loader for the CMS Physician Fee Schedule into `fee_schedule`.

DO NOT RUN THIS CASUALLY: it TRUNCATEs the table. It is kept for provenance and so
that a CMS release can be reloaded deliberately. For correcting rates in place, use
`fix_fee_schedule_rates.py`, which only UPDATEs and never empties the table.

Source file: PFALL26AR.txt, from
https://www.cms.gov/files/zip/pfrev26a-updated-12-29-2025.zip
  -> PFREV26AR_nonQP.zip -> PFALL26AR.txt   (CY2026, non-QP conversion factor $33.40)

Column layout (verified against the real file, 2026-08-04):

    ['2026', '01112', '05', '0446T', '  ', '0008896.73', '0000054.12', ...]
      YEAR    MAC     LOC    HCPCS    MOD    NON-FAC       FACILITY
       [0]    [1]     [2]     [3]     [4]      [5]           [6]

Each code appears once per MAC-locality (109 of them) *per modifier*. The MODIFIER
column is the one that matters and the original loader ignored it: averaging the
global row together with `26` (professional component) and `TC` (technical component)
stores exactly (G + PC + TC)/3 = 2G/3, i.e. two thirds of the true rate, for every
split-billable code. That understated 833 codes (radiology, cardiology, pathology)
and inflated every overcharge multiple shown for them by exactly 1.5x.
"""

import csv
import os
from collections import defaultdict

MODIFIER_GLOBAL = ""
MODIFIER_PROFESSIONAL = "26"


def parse_fee_file(path: str) -> dict[str, tuple[float, float, bool]]:
    """Parse PFALL26AR.txt into {hcpcs_code: (non_facility, facility, professional_only)}.

    Only the **global** (blank-modifier) rows are used, averaged across MAC-localities.
    Codes that publish no global row at all — 117 professional-component-only codes —
    fall back to their `26` rows and are flagged `professional_only`, because a PC rate
    is not comparable to a full billed charge and the caller must not treat it as one.

    Rows with a non-positive non-facility rate are dropped, which is what keeps
    anaesthesia codes (no PFS RVUs) out of the table entirely so they surface as
    Unverified rather than as a wrong number. Preserve that behaviour.
    """
    by_code_modifier: dict[str, dict[str, list[tuple[float, float]]]] = defaultdict(
        lambda: defaultdict(list)
    )

    with open(path, "r") as f:
        for row in csv.reader(f):
            if len(row) < 7:
                continue
            try:
                non_facility = float(row[5].strip())
                facility = float(row[6].strip())
            except (ValueError, IndexError):
                continue
            if non_facility <= 0:
                continue
            by_code_modifier[row[3].strip()][row[4].strip()].append((non_facility, facility))

    rates: dict[str, tuple[float, float, bool]] = {}
    for code, by_modifier in by_code_modifier.items():
        professional_only = MODIFIER_GLOBAL not in by_modifier
        modifier = MODIFIER_PROFESSIONAL if professional_only else MODIFIER_GLOBAL
        rows = by_modifier.get(modifier)
        if not rows:
            continue  # neither a global nor a PC row: nothing safe to publish
        rates[code] = (
            round(sum(r[0] for r in rows) / len(rows), 2),
            round(sum(r[1] for r in rows) / len(rows), 2),
            professional_only,
        )
    return rates


def main() -> None:
    import psycopg2
    from dotenv import load_dotenv
    from psycopg2.extras import execute_values

    load_dotenv()

    rates = parse_fee_file("PFALL26AR.txt")
    professional_only_count = sum(1 for v in rates.values() if v[2])
    print(f"Parsed {len(rates)} HCPCS codes ({professional_only_count} professional-component only).")
    if not rates:
        print("No valid rows parsed. Stopping before touching the database.")
        raise SystemExit(1)

    confirm = input(f"TRUNCATE and reload fee_schedule with {len(rates)} rows? Type 'reload': ")
    if confirm != "reload":
        print("Aborted.")
        raise SystemExit(1)

    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=15)
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE fee_schedule")
    execute_values(
        cur,
        "INSERT INTO fee_schedule (hcpcs_code, non_facility_rate, facility_rate, professional_only) VALUES %s",
        [(code, non_fac, fac, pc_only) for code, (non_fac, fac, pc_only) in rates.items()],
        page_size=1000,
    )
    conn.commit()
    cur.close()
    conn.close()
    print(f"Done. Loaded {len(rates)} HCPCS codes into fee_schedule.")


if __name__ == "__main__":
    main()
