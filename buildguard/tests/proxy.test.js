import { afterEach, describe, expect, it } from "vitest";
import { allowedOrigins, modalHeaders, originAllowed } from "../lib/proxy.js";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

function reqWithOrigin(origin) {
  return { headers: origin === undefined ? {} : { origin } };
}

describe("allowedOrigins", () => {
  it("returns the defaults when ALLOWED_ORIGINS is unset", () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(allowedOrigins()).toContain("https://medbill.kyuruki.cc");
  });

  it("parses a comma-separated override, trimming blanks", () => {
    process.env.ALLOWED_ORIGINS = " https://a.example , https://b.example ,, ";
    expect(allowedOrigins()).toEqual(["https://a.example", "https://b.example"]);
  });
});

describe("originAllowed", () => {
  it("passes requests with no Origin header (server-to-server, same-origin GET)", () => {
    expect(originAllowed(reqWithOrigin(undefined))).toBe(true);
  });

  it("accepts an origin on the allowlist", () => {
    expect(originAllowed(reqWithOrigin("https://medbill.kyuruki.cc"))).toBe(true);
  });

  it("accepts any https subdomain of the owned custom domain", () => {
    expect(originAllowed(reqWithOrigin("https://preview.kyuruki.cc"))).toBe(true);
    expect(originAllowed(reqWithOrigin("https://kyuruki.cc"))).toBe(true);
  });

  it("rejects http (non-https) origins even on the owned domain", () => {
    expect(originAllowed(reqWithOrigin("http://kyuruki.cc"))).toBe(false);
  });

  it("accepts this project's Vercel preview deployments only", () => {
    expect(originAllowed(reqWithOrigin("https://buildguard-abc-kyurukis-projects.vercel.app"))).toBe(true);
    expect(originAllowed(reqWithOrigin("https://buildguard-git-main-kyurukis-projects.vercel.app"))).toBe(true);
    expect(originAllowed(reqWithOrigin("https://buildguard-evil.vercel.app"))).toBe(false);
  });

  it("rejects a hostile prefix on the team suffix", () => {
    // The previous endsWith() check accepted these (verified live against production).
    expect(originAllowed(reqWithOrigin("https://x-attacker-kyurukis-projects.vercel.app"))).toBe(false);
    expect(originAllowed(reqWithOrigin("https://evil-kyurukis-projects.vercel.app"))).toBe(false);
    expect(originAllowed(reqWithOrigin("https://-kyurukis-projects.vercel.app"))).toBe(false);
  });

  it("rejects another project under the same team", () => {
    expect(originAllowed(reqWithOrigin("https://otherapp-abc-kyurukis-projects.vercel.app"))).toBe(false);
  });

  it("rejects the team suffix used as a prefix of another domain", () => {
    expect(originAllowed(reqWithOrigin("https://buildguard-a-kyurukis-projects.vercel.app.evil.io"))).toBe(false);
  });

  it("rejects lookalike domains", () => {
    expect(originAllowed(reqWithOrigin("https://evilkyuruki.cc"))).toBe(false);
    expect(originAllowed(reqWithOrigin("https://kyuruki.cc.attacker.io"))).toBe(false);
  });

  it("rejects unparseable origins such as 'null'", () => {
    expect(originAllowed(reqWithOrigin("null"))).toBe(false);
  });

  it("honors an ALLOWED_ORIGINS override", () => {
    process.env.ALLOWED_ORIGINS = "https://only.example";
    expect(originAllowed(reqWithOrigin("https://only.example"))).toBe(true);
  });
});

describe("modalHeaders", () => {
  it("attaches the shared secret when configured", () => {
    process.env.PROXY_SHARED_SECRET = "s3cret";
    expect(modalHeaders({ a: "1" })).toEqual({ a: "1", "x-proxy-secret": "s3cret" });
  });

  it("omits the secret header when not configured", () => {
    delete process.env.PROXY_SHARED_SECRET;
    expect(modalHeaders()).toEqual({});
  });
});
