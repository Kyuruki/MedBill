import { Link } from "react-router-dom";
import { NAV, DISCLAIMER } from "../content.js";
import { Container } from "./ui.jsx";
import BrandMark from "./BrandMark.jsx";

const FOOTER_LINKS = [
  ...NAV,
  { to: "/privacy", label: "Privacy & health data" },
  { to: "/analyze", label: "Analyze a bill" },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-paper-2">
      <Container className="py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link to="/" className="flex items-center gap-2 rounded-md text-ink">
              <BrandMark className="h-6 w-6 text-brand-600" />
              <span className="text-base font-semibold tracking-tight">MedBill Analyzer</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              A second opinion on your medical bill. Check charges against CMS Medicare reference rates.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-2">
            {FOOTER_LINKS.map((item) => (
              <Link key={item.to} to={item.to} className="rounded-md text-sm font-medium text-ink-soft hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
      </Container>
    </footer>
  );
}
