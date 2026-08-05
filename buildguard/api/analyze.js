import formidable from "formidable";
import { Writable } from "node:stream";
import { originAllowed, modalHeaders, MODAL_ANALYZE_URL } from "../lib/proxy.js";
import { rateLimit, clientIp } from "../lib/ratelimit.js";

// formidable needs the raw request stream, so disable Vercel's body parsing.
export const config = { api: { bodyParser: false } };

// 4 MB, not the backend's 20 MB: Vercel rejects request bodies over 4.5 MB before this
// function is invoked, so anything larger can never reach formidable anyway. Advertising
// the real limit is the only way the user gets our error instead of a platform one.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ANALYZE_RULES = [
  { name: "min", limit: 10, windowMs: 60_000 },
  { name: "day", limit: 50, windowMs: 86_400_000 },
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ detail: "Forbidden" });
  }
  const rl = await rateLimit(req, "analyze", ANALYZE_RULES);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({ detail: "You've hit the analysis limit. Please wait a moment and try again." });
  }

  // Buffer the single uploaded file in memory; never spool PHI to disk.
  const chunks = [];
  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_UPLOAD_BYTES,
    fileWriteStreamHandler: () =>
      new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk);
          cb();
        },
      }),
  });

  let uploaded;
  try {
    const [, files] = await form.parse(req);
    uploaded = files?.file?.[0];
  } catch (err) {
    if (err && /maxFileSize|options\.maxFileSize/i.test(String(err.message))) {
      return res.status(413).json({
        detail:
          "That file is too large to upload (the limit is 4 MB). Phone photos are often bigger than this: try screenshotting the bill, or scanning it to PDF.",
      });
    }
    return res.status(400).json({ detail: "Could not read the uploaded file." });
  }

  if (!uploaded) {
    return res.status(400).json({ detail: "No file provided." });
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    return res.status(400).json({ detail: "Empty upload." });
  }

  try {
    // Forward the raw bytes (not multipart) so Modal reads them straight into
    // memory without Starlette's UploadFile spooling to disk.
    const modalResponse = await fetch(MODAL_ANALYZE_URL, {
      method: "POST",
      body: buffer,
      headers: modalHeaders({
        "Content-Type": uploaded.mimetype || "application/octet-stream",
        "x-client-ip": clientIp(req),
      }),
      // Abort before Vercel's function timeout so a very large/dense PDF returns a
      // clean error instead of a raw platform 504. (Keep < vercel.json maxDuration.)
      signal: AbortSignal.timeout(55000),
    });
    const data = await modalResponse.json().catch(() => ({ detail: "Upstream error." }));
    return res.status(modalResponse.status).json(data);
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return res.status(504).json({ detail: "This bill took too long to analyze. Try a smaller or clearer file (fewer pages)." });
    }
    return res.status(502).json({ detail: "Failed to reach analysis backend." });
  }
}
