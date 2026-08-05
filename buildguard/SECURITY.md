# Security & Data Handling — MedBill Analyzer

This document describes MedBill Analyzer's security model, the endpoint contract, rate limits,
and how uploaded data is handled. It reflects the state after the hardening effort (see
`SECURITY_FINDINGS.md` for the pre-fix baseline).

## Threat model in brief

MedBill Analyzer is **anonymous by design** — no accounts, no login, no stored user data. The
assets worth protecting are therefore not user credentials but:
- **the operator's paid API budget** (the Anthropic key used for letters),
- **backend availability** (OCR/rendering compute on Modal), and
- **the privacy of a bill while it's being processed** (health-adjacent data).

## Trust boundaries

```
Browser ──(same-origin fetch)──▶ Vercel /api proxy ──(X-Proxy-Secret)──▶ Modal ──▶ Neon (read-only)
                                                                          └──▶ Anthropic (letters)
```

- **The `/api` proxy is the only intended caller of Modal.** It attaches an
  `X-Proxy-Secret` header (value = `PROXY_SHARED_SECRET`). Modal verifies it with a
  constant-time compare and returns **403** otherwise. The check **fails closed**: if the
  secret is not configured, Modal returns **503** rather than accepting everyone (local
  dev can opt out with `DANGEROUSLY_ALLOW_UNAUTHENTICATED_PROXY=1`).
- **The proxy rejects browser cross-origin requests** via an Origin allowlist
  (`lib/proxy.js`): the custom domain (`*.kyuruki.cc`) and this project's own Vercel
  hosts. Requests with no `Origin` (server-to-server) pass this gate — the shared secret
  is the real control there.
- **The Modal URLs are not exposed to the browser.** They live only in the server-side
  proxy; the client bundle contains no endpoints or secrets (verified against the build).

## Endpoint contract

All proxy/backend errors use the shape `{ "detail": "..." }` with a real HTTP status; no
stack traces, paths, or secrets are ever returned to the client.

### `POST /api/analyze` → Modal `analyze`
- Request: `multipart/form-data`, field **`file`** (browser → proxy). The proxy buffers
  it in memory and forwards the **raw bytes** to Modal with `X-Proxy-Secret` + `X-Client-IP`.
- Validation: **magic-byte** sniff (PNG/JPEG/PDF only), **4 MB** proxy cap (Vercel rejects
  bodies over 4.5 MB before the function runs; the backend's own 20 MB ceiling is
  therefore unreachable), decompression-bomb
  guards (see below).
- Response: `{ status, request_id, line_items[], line_items_found }`. **No raw OCR text or
  per-line raw text is returned** (PHI minimization).

### `POST /api/generate-letter` → Modal `generate_letter`
- Request: JSON `{ line_items, patient_name?, provider_name?, account_no?, statement_date? }`.
  The proxy whitelists fields (line items reduced to `code` + `charged`) and forwards with
  `X-Proxy-Secret` + `X-Client-IP`.
- **Server-side re-verification:** the backend ignores client-supplied rates and re-derives
  overcharges from the CMS tables, so the letter only ever cites verified figures.
- Response: `{ status, request_id, letter }` or `{ status, letter: null, message }`.

### `GET` Modal `health`
- Public liveness probe; no secret required; returns no sensitive data.

## Rate limits (abuse prevention)

Primary limits are enforced **per-IP at the Vercel proxy** (`lib/ratelimit.js`); Modal adds
a coarser **per-container** cap as defense-in-depth (keyed on the proxy-forwarded
`X-Client-IP`). Over-limit requests return **HTTP 429** with a `Retry-After` header and a
UI-friendly `{ detail }` message.

| Endpoint             | Proxy limit (per IP)     | Modal backstop (per container) |
|----------------------|--------------------------|--------------------------------|
| `/api/analyze`       | 10 / minute, 50 / day    | 30 / minute                    |
| `/api/generate-letter` | 5 / hour               | 15 / hour                      |

**Known limitation (documented tradeoff):** the proxy limiter is **best-effort and
in-memory per serverless instance** — counters are not shared across instances and reset
on cold starts, so a client spread over N warm instances can get up to N× the limit. This
raises the cost of casual abuse but is not a hard guarantee. Swap `lib/ratelimit.js` for
Upstash/Redis for durable, cross-instance limits.

## Upload safety (DoS / decompression bombs)

- **Type** is decided by magic bytes, never by extension or client `Content-Type`.
- **Size:** 4 MB cap at the proxy (`maxFileSize`), enforced first by Vercel's own 4.5 MB
  request-body limit; the backend keeps a 20 MB ceiling as defense-in-depth.
- **Images:** rejected before decoding if dimensions exceed the pixel/dimension caps;
  `Image.MAX_IMAGE_PIXELS` guards against decompression bombs.
- **PDFs:** rendered fully **in memory with PyMuPDF** (no poppler subprocess/tempfiles).
  Page count is capped at 30, and every page's projected bitmap size (MediaBox × UserUnit
  at the render DPI) is checked **before** rasterizing — so neither a many-page nor a
  single-giant-page PDF can exhaust memory.
- Malformed/unreadable input returns a clean **400/415**, never a 500 with internals.

## Prompt-injection defense (letter generation)

The OCR-derived and client-supplied text is **untrusted input**. The letter endpoint:
- puts the standing instructions in the Claude **`system`** prompt;
- wraps the untrusted values in a delimited **`<bill_data>`** fence in the user message,
  and instructs the model to treat everything inside it strictly as data, never as
  instructions;
- **sanitizes** each free-text field (strips control characters and angle brackets so it
  can't break out of the fence, and caps length);
- constrains `code` to 5 digits and caps `line_items` at 50;
- re-derives all rates server-side, so a crafted bill cannot fabricate an "overcharge".

## Data-handling / privacy policy

- **In-memory only.** The upload is read into memory and discarded when the request ends.
  MedBill Analyzer **does not persist** the bill image, the extracted text, or any personal/health
  information to disk or a database, anywhere in the pipeline. PDF rendering is in-memory
  (PyMuPDF); nothing touches disk.
- **No accounts, no history, no tracking profile.** IPs are used transiently for rate
  limiting only and are not tied to bill contents.
- **Third party:** generating a dispute letter sends verified overcharge details (codes,
  charged amounts, CMS reference rates) plus any name the user enters to Anthropic's Claude
  API. **The bill image is never sent.** This is disclosed on the Privacy page; users can
  stop after the results table.
- **Reference data** (`fee_schedule`, `clfs_fee_schedule`) is read-only and contains no
  personal data.

## Transport & headers (`vercel.json`)

Applied site-wide: **Content-Security-Policy** (`default-src 'self'`, no inline scripts),
**Strict-Transport-Security** (preload), **X-Content-Type-Options: nosniff**,
**X-Frame-Options: DENY**, **Referrer-Policy: no-referrer**, and a restrictive
**Permissions-Policy** (camera/microphone/geolocation/browsing-topics disabled).

## Dependency posture

- **Python** deps are pinned in the Modal image and checked against OSV — no known
  advisories (as of 2026-06-30).
- **npm:** the only advisories are **`vite`** and **`@babel/core`**, both **dev/build-time,
  Windows-only** tools — they do not run in production (the deployed site is static assets
  + serverless functions). No non-breaking upgrade is currently available; tracked for a
  future major bump.

## Secrets

`neon-db` (DATABASE_URL), `anthropic-secret` (ANTHROPIC_API_KEY), and `proxy-auth`
(PROXY_SHARED_SECRET) are Modal secrets. `PROXY_SHARED_SECRET` is also a Vercel env var
(same value). No secret is exposed to the client. Rotating a secret requires updating both
the Modal secret and the Vercel env var to the same new value.

## Reporting

This is a personal project with no formal disclosure program. Open a GitHub issue for
non-sensitive reports; for anything sensitive, contact the maintainer directly.
