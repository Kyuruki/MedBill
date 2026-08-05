// Single source of truth for site copy and structured data.
// Reused by pages, the layout (route titles), and Phase 4 JSON-LD (FAQ/steps).

export const SITE = {
  name: "MedBill Analyzer",
  tagline: "A second opinion on your medical bill.",
  description:
    "Upload a medical bill and check its charges against official CMS Medicare reference rates. See how each charge compares and draft a letter requesting a review.",
  url: "https://medbill.kyuruki.cc",
};

// Contact route for privacy / consumer-health-data rights requests. Washington's
// My Health My Data Act requires a stated mechanism to exercise those rights, so
// this address has to actually receive mail.
export const CONTACT_EMAIL = "privacy@kyuruki.cc";

// The third parties that process a request, by category. MHMDA RCW 19.373.020
// requires the categories of third parties with whom data is shared to be listed,
// so this is the source of truth for that table and must stay accurate.
export const PROCESSORS = [
  {
    name: "Vercel",
    role: "Website hosting and the API layer",
    data: "Receives your upload in transit and your IP address. Does not store the file.",
  },
  {
    name: "Modal",
    role: "Runs the analysis (OCR and code extraction)",
    data: "Processes the bill in memory to read text. Nothing is written to disk or kept.",
  },
  {
    name: "Neon",
    role: "Database of published CMS reference rates",
    data: "Holds no data from your bill. Also stores the rate-limit counters described below.",
  },
  {
    name: "Anthropic",
    role: "Drafts the letter, only if you ask for one",
    data: "Receives the billing codes, amounts and CMS rates, plus any name you type. Never the bill image or the scanned text.",
  },
];

// Primary nav (header). Privacy lives in the footer.
export const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
];

// Per-route title + meta description (used for <title>, <meta>, OG/Twitter, and the
// screen-reader route announcement). Keep titles ≤ ~60 chars, descriptions ≤ ~160.
export const PAGE_META = {
  "/": {
    title: "MedBill Analyzer: Check your medical bill against Medicare rates",
    description:
      "Upload a medical bill and check its charges against official CMS Medicare reference rates. See how each charge compares and draft a letter requesting a review. Free, anonymous, nothing stored.",
  },
  "/analyze": {
    title: "Analyze a bill | MedBill Analyzer",
    description:
      "Upload a bill to check every code against CMS Medicare reference rates, see how each charge compares, and generate a letter requesting a review. Processed in memory, never stored.",
  },
  "/how-it-works": {
    title: "How it works | MedBill Analyzer",
    description:
      "How MedBill Analyzer reads your bill: OCR extracts the codes and charges, then compares each to two official CMS fee schedules. No AI guesses at your numbers.",
  },
  "/faq": {
    title: "FAQ | MedBill Analyzer",
    description:
      "Answers about how MedBill Analyzer compares charges to CMS Medicare reference rates, what those rates mean, how your bill is handled, and whether it's affiliated with Medicare.",
  },
  "/privacy": {
    title: "Consumer Health Data Privacy Policy | MedBill Analyzer",
    description:
      "What MedBill Analyzer collects from your bill, why, who processes it, and how to exercise your rights. Bills are processed in memory and discarded; there are no accounts.",
  },
  "/about": {
    title: "About | MedBill Analyzer",
    description:
      "Why MedBill Analyzer exists: an independent, transparent tool that checks medical bills against public CMS Medicare rates so you can question charges with confidence.",
  },
};

export const DEFAULT_META = PAGE_META["/"];

// The disclaimer. Used in the footer, the tool, and Privacy.
export const DISCLAIMER =
  "MedBill Analyzer is an informational tool, not legal, medical, or financial advice. It is not affiliated with CMS, Medicare, or any insurer. Medicare reference rates are a benchmark, not a statement of what you owe. Verify against your own bill and plan before acting.";

// How-it-works steps, in order.
export const STEPS = [
  {
    n: "01",
    title: "Upload your bill",
    body: "Add a photo or PDF of an itemized medical bill. It's read in memory and never stored.",
  },
  {
    n: "02",
    title: "We read the codes and charges",
    body: "Optical character recognition pulls out the CPT/HCPCS codes and dollar amounts. It's plain pattern matching, with no AI guessing at your numbers.",
  },
  {
    n: "03",
    title: "We compare to CMS Medicare rates",
    body: "Each code is checked against two official CMS fee schedules: the Physician Fee Schedule and the Clinical Laboratory Fee Schedule.",
  },
  {
    n: "04",
    title: "See how each line compares",
    body: "Every line shows what you were charged as a multiple of the Medicare reference rate. If charges sit well above it, generate a letter requesting a review.",
  },
];

export const FAQ = [
  {
    q: "What does MedBill Analyzer actually do?",
    a: "It reads the billing codes and charges off your bill, looks each code up in official CMS Medicare fee schedules, and shows you what each charge works out to as a multiple of that reference rate. If any sit far above it, it can draft a letter requesting a review for you to check and send.",
  },
  {
    q: "How should I read the multiple next to each line?",
    a: "For each 5-digit CPT/HCPCS code, MedBill Analyzer divides the amount charged by the CMS Medicare reference rate for that code. Almost every US bill sits above the reference rate, so a multiple on its own is not a problem: negotiated commercial rates commonly run around two to three times Medicare. It is the far outliers, roughly five times and up, that are worth questioning. MedBill Analyzer only shows a multiple for codes it can confirm in the CMS data.",
  },
  {
    q: "What are CMS Medicare reference rates?",
    a: "CMS (the Centers for Medicare & Medicaid Services) publishes standardized payment rates for medical procedures. They're a widely used benchmark for what a service costs. They are not a cap on what a provider may bill or what you owe, but a charge many times the reference rate is worth questioning.",
  },
  {
    q: "Is my bill stored anywhere?",
    a: "No. Your upload is processed in memory to read the text, then discarded. MedBill Analyzer does not save your bill image, the extracted text, or any personal or health information to disk or a database. There are no accounts.",
  },
  {
    q: "Why are some codes marked 'Unverified'?",
    a: "Not every code appears in the CMS fee schedules MedBill Analyzer checks (for example, some facility fees or bundled items). When a code isn't in the data, MedBill Analyzer marks it Unverified rather than guessing. It never asserts an overcharge it can't confirm.",
  },
  {
    q: "Does a high multiple mean I was defrauded?",
    a: "No. A charge above the Medicare reference rate is normal and usually entirely legitimate: negotiated commercial rates typically run around two to three times Medicare, and facility costs and your specific plan vary on top of that. A high multiple is a prompt to ask for an itemized justification, not an accusation.",
  },
  {
    q: "Can I really dispute a bill with the letter?",
    a: "The letter is a professional, first-person request for review and itemization that you can copy, edit, and send to your provider's billing department. It's a starting point you control, not a legal filing, and not a guarantee of an adjustment.",
  },
  {
    q: "What files can I upload?",
    a: "A PNG, JPEG, or PDF up to 4 MB (PDFs up to 30 pages). Clearer scans and photos read more accurately. Phone photos are often larger than 4 MB, so you may need to reduce the size or screenshot the bill first.",
  },
  {
    q: "Is MedBill Analyzer affiliated with Medicare or my insurer?",
    a: "No. MedBill Analyzer is an independent, informational tool. It is not affiliated with, endorsed by, or connected to CMS, Medicare, or any insurance company.",
  },
];
