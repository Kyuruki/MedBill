"""Correct `fee_schedule` rates in place. UPDATE-only: never TRUNCATEs, never DELETEs.

Why this exists: the original `load_fees.py` ignored the MODIFIER column and averaged
each code's global, `26` (professional component) and `TC` (technical component) rows
into one number. Since PC + TC = global, that stored exactly 2/3 of the true rate for
every split-billable code — 833 of 7,835 — so every overcharge multiple shown for
radiology, cardiology and pathology was inflated by exactly 1.5x, and any charge
between 0.667x and 1x of the true rate was reported as an overcharge that wasn't one.

`load_fees.py` is now modifier-aware, but re-running it would TRUNCATE the live table
and open a window where every lookup returns "Unverified". This script re-derives the
same values and writes only the rows that differ.

Dry run (default) prints what would change and touches nothing:

    python fix_fee_schedule_rates.py

Apply:

    python fix_fee_schedule_rates.py --apply

Needs DATABASE_URL in .env, and PFALL26AR.txt (downloaded automatically if absent).
"""

import argparse
import io
import os
import urllib.request
import zipfile

from load_fees import parse_fee_file

SOURCE_FILE = "PFALL26AR.txt"
SOURCE_URL = "https://www.cms.gov/files/zip/pfrev26a-updated-12-29-2025.zip"
INNER_ZIP = "PFREV26AR_nonQP.zip"


def _entry_named(archive: zipfile.ZipFile, filename: str) -> str:
    """Find an entry by filename regardless of its directory prefix. CMS nests these
    under a directory whose name has a trailing space ("PFREV26A /"), so matching on
    the full path is brittle."""
    for name in archive.namelist():
        if name.rsplit("/", 1)[-1] == filename:
            return name
    raise SystemExit(f"{filename} not found in archive; contents: {archive.namelist()}")


def ensure_source_file(path: str = SOURCE_FILE) -> str:
    """Fetch PFALL26AR.txt from CMS if it isn't already on disk. It lives in a zip
    inside a zip, and it is ~137 MB unpacked.

    nonQP is the correct variant: CY2026 has two conversion factors ($33.40 non-QP,
    $33.57 QP) and the loaded table was built from the non-QP file.
    """
    if os.path.exists(path):
        return path

    print(f"{path} not found; downloading from CMS (~40 MB compressed)...")
    with urllib.request.urlopen(SOURCE_URL, timeout=300) as response:
        outer = zipfile.ZipFile(io.BytesIO(response.read()))
    with outer.open(_entry_named(outer, INNER_ZIP)) as inner_bytes:
        inner = zipfile.ZipFile(io.BytesIO(inner_bytes.read()))
    with inner.open(_entry_named(inner, SOURCE_FILE)) as src, open(path, "wb") as dst:
        dst.write(src.read())
    print(f"Wrote {path} ({os.path.getsize(path):,} bytes).")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    args = parser.parse_args()

    import psycopg2
    from dotenv import load_dotenv
    from psycopg2.extras import execute_values

    load_dotenv()

    correct = parse_fee_file(ensure_source_file())
    print(f"Parsed {len(correct)} codes from CMS source.")

    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=15)
    try:
        with conn.cursor() as cur:
            # Additive migration only. Both are no-ops on a second run.
            cur.execute(
                "ALTER TABLE fee_schedule "
                "ADD COLUMN IF NOT EXISTS professional_only boolean NOT NULL DEFAULT false"
            )
            # A primary key is what would have made the original averaging bug fail
            # loudly instead of silently deduplicating via a Python dict.
            cur.execute(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_schedule_pkey') "
                "THEN ALTER TABLE fee_schedule ADD PRIMARY KEY (hcpcs_code); END IF; END $$"
            )
            if not args.apply:
                conn.rollback()
                with conn.cursor() as c2:
                    c2.execute("SELECT hcpcs_code, non_facility_rate, facility_rate FROM fee_schedule")
                    current = {r[0]: (float(r[1]), float(r[2]), False) for r in c2.fetchall()}
            else:
                cur.execute(
                    "SELECT hcpcs_code, non_facility_rate, facility_rate, professional_only FROM fee_schedule"
                )
                current = {r[0]: (float(r[1]), float(r[2]), r[3]) for r in cur.fetchall()}

            changed = [
                (code, *correct[code]) for code in current if code in correct and current[code] != correct[code]
            ]
            missing_in_db = sorted(set(correct) - set(current))
            missing_in_source = sorted(set(current) - set(correct))

            print(f"\nRows differing:            {len(changed)}")
            print(f"In CMS source, not in DB:  {len(missing_in_db)} (left alone)")
            print(f"In DB, not in CMS source:  {len(missing_in_source)} (left alone)")

            for code, non_fac, _fac, pc_only in sorted(changed, key=lambda r: r[0])[:10]:
                old = current[code][0]
                flag = " [professional-component only]" if pc_only else ""
                print(f"  {code}: {old:>10.2f} -> {non_fac:>10.2f}  ({non_fac / old:.3f}x){flag}")
            if len(changed) > 10:
                print(f"  ... and {len(changed) - 10} more")

            if not args.apply:
                conn.rollback()
                print("\nDry run: nothing written. Re-run with --apply to commit.")
                return

            execute_values(
                cur,
                "UPDATE fee_schedule AS f SET non_facility_rate = v.non_fac, "
                "facility_rate = v.fac, professional_only = v.pc_only "
                "FROM (VALUES %s) AS v(code, non_fac, fac, pc_only) "
                "WHERE f.hcpcs_code = v.code",
                changed,
                template="(%s, %s::numeric, %s::numeric, %s::boolean)",
                page_size=1000,
            )
            conn.commit()
            print(f"\nApplied. {len(changed)} rows updated; table never emptied.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
