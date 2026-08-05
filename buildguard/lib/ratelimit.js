// Per-IP rate limiting for the Vercel proxy, durable across serverless instances.
//
// The primary counter lives in Postgres (the Neon instance already used for the CMS
// reference tables), because the previous in-memory implementation did not actually
// limit anything: Vercel runs many instances, each with its own Map, so concurrency
// multiplied the cap away. A live measurement against production served 48 of 50
// requests from one IP in ~70s against a documented 10/min.
//
// If the database is unreachable or slow, this falls back to the in-memory limiter
// rather than failing the request. That is weaker, but it is what the service had
// before, and a rate limiter should not be able to take the site down.
//
// PRIVACY: the raw IP is never stored. The key is an HMAC of the IP keyed on
// PROXY_SHARED_SECRET, so the stored value is not reversible by anyone who obtains a
// database dump — brute-forcing the whole IPv4 space is otherwise trivial. Rows carry
// their own expiry and are swept opportunistically. This is disclosed on the privacy
// page as the one thing the service does retain.

import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const QUERY_TIMEOUT_MS = 1500; // a slow counter must not hold up the upload
const SWEEP_PROBABILITY = 0.005; // ~1 in 200 requests clears expired rows

// One statement handles every rule: rows whose window has expired restart at 1,
// the rest increment. ON CONFLICT makes it atomic across concurrent instances,
// which is the entire point of moving off the in-memory Map.
const UPSERT = `
  INSERT INTO rate_limit (key, count, reset_at)
  SELECT k, 1, now() + (ms * interval '1 millisecond')
    FROM unnest($1::text[], $2::bigint[]) AS t(k, ms)
  ON CONFLICT (key) DO UPDATE
     SET count = CASE WHEN rate_limit.reset_at <= now() THEN 1 ELSE rate_limit.count + 1 END,
         reset_at = CASE WHEN rate_limit.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit.reset_at END
  RETURNING key, count, ceil(extract(epoch FROM reset_at - now()))::int AS retry_after`;

let client; // undefined = not yet resolved, null = unavailable
function db() {
  if (client === undefined) {
    client = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  }
  return client;
}

function hashKey(ip, bucket, rule) {
  // Keyed hash, not a bare digest: an unsalted sha256 of an IPv4 address is
  // reversible by exhausting 2^32 candidates in seconds.
  return createHmac("sha256", process.env.PROXY_SHARED_SECRET || "unkeyed")
    .update(`${ip}:${bucket}:${rule}`)
    .digest("base64url");
}

export function clientIp(req) {
  // Prefer x-real-ip: Vercel sets it to the true connecting IP and overwrites any
  // client-supplied value, so it can't be spoofed to farm fresh rate-limit buckets.
  // Fall back to the first x-forwarded-for entry (Vercel-normalized) only if absent.
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// --- In-memory fallback (previously the only implementation) --------------------

const store = new Map(); // `${ip}:${bucket}:${rule}` -> { count, resetAt }

let lastPrune = 0;
function maybePrune(now) {
  if (now - lastPrune < 60_000 && store.size < 10_000) return;
  lastPrune = now;
  for (const [k, e] of store) if (now >= e.resetAt) store.delete(k);
}

export function memoryRateLimit(req, bucket, rules) {
  const now = Date.now();
  maybePrune(now);
  const ip = clientIp(req);

  const entries = rules.map((r) => {
    const key = `${ip}:${bucket}:${r.name}`;
    let e = store.get(key);
    if (!e || now >= e.resetAt) e = { count: 0, resetAt: now + r.windowMs };
    return { r, key, e };
  });

  const blocked = entries.filter((x) => x.e.count + 1 > x.r.limit);
  if (blocked.length) {
    const retryMs = Math.max(...blocked.map((x) => x.e.resetAt - now));
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)), durable: false };
  }

  for (const x of entries) {
    x.e.count += 1;
    store.set(x.key, x.e);
  }
  return { allowed: true, durable: false };
}

// --- Durable limiter -----------------------------------------------------------

// rules: [{ name, limit, windowMs }]. Returns { allowed, retryAfterSec?, durable }.
// Unlike the in-memory version this increments first and then checks, because the
// increment has to be atomic to be meaningful across instances. A denied request
// therefore consumes quota — which is the correct behaviour for abuse, and does not
// extend the window.
export async function rateLimit(req, bucket, rules) {
  const sql = db();
  if (!sql) return memoryRateLimit(req, bucket, rules);

  const ip = clientIp(req);
  const keys = rules.map((r) => hashKey(ip, bucket, r.name));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    let rows;
    try {
      rows = await sql.query(
        UPSERT,
        [keys, rules.map((r) => Math.round(r.windowMs))],
        { fetchOptions: { signal: controller.signal } },
      );
    } finally {
      clearTimeout(timer);
    }

    const byKey = new Map(rows.map((row) => [row.key, row]));
    const blocked = rules
      .map((r, i) => ({ r, row: byKey.get(keys[i]) }))
      .filter((x) => x.row && x.row.count > x.r.limit);

    if (blocked.length) {
      const retry = Math.max(...blocked.map((x) => x.row.retry_after));
      return { allowed: false, retryAfterSec: Math.max(1, retry), durable: true };
    }

    if (Math.random() < SWEEP_PROBABILITY) {
      await sql.query("DELETE FROM rate_limit WHERE reset_at < now() - interval '1 day'");
    }
    return { allowed: true, durable: true };
  } catch (err) {
    // Degraded, not open: the in-memory limiter still applies, as does the coarse
    // per-container cap on the Modal side.
    console.error("rate limiter degraded to in-memory:", err?.message || err);
    return memoryRateLimit(req, bucket, rules);
  }
}
