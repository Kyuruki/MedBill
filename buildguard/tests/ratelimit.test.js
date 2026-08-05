import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("@neondatabase/serverless", () => ({
  neon: () => ({ query: queryMock }),
}));

function req(ip, extraHeaders = {}) {
  return { headers: { "x-real-ip": ip, ...extraHeaders }, socket: { remoteAddress: "9.9.9.9" } };
}

// The module caches its client on first use, so each test that cares about the
// DATABASE_URL branch needs a fresh import.
async function loadModule({ databaseUrl } = {}) {
  vi.resetModules();
  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
  else delete process.env.DATABASE_URL;
  process.env.PROXY_SHARED_SECRET = "test-secret";
  return import("../lib/ratelimit.js");
}

describe("clientIp", () => {
  it("prefers x-real-ip", async () => {
    const { clientIp } = await loadModule();
    expect(clientIp(req("1.2.3.4", { "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for entry", async () => {
    const { clientIp } = await loadModule();
    expect(clientIp({ headers: { "x-forwarded-for": " 5.6.7.8 , 10.0.0.1" } })).toBe("5.6.7.8");
  });

  it("falls back to the socket address, then 'unknown'", async () => {
    const { clientIp } = await loadModule();
    expect(clientIp({ headers: {}, socket: { remoteAddress: "9.9.9.9" } })).toBe("9.9.9.9");
    expect(clientIp({ headers: {} })).toBe("unknown");
  });
});

describe("memoryRateLimit (fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const RULES = [{ name: "min", limit: 3, windowMs: 60_000 }];

  it("allows up to the limit, then denies with a Retry-After hint", async () => {
    const { memoryRateLimit } = await loadModule();
    const r = req("10.0.0.1");
    for (let i = 0; i < 3; i++) expect(memoryRateLimit(r, "bucketA", RULES).allowed).toBe(true);
    const denied = memoryRateLimit(r, "bucketA", RULES);
    expect(denied.allowed).toBe(false);
    expect(denied.durable).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets after the window elapses", async () => {
    const { memoryRateLimit } = await loadModule();
    const r = req("10.0.0.2");
    for (let i = 0; i < 3; i++) memoryRateLimit(r, "bucketB", RULES);
    expect(memoryRateLimit(r, "bucketB", RULES).allowed).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(memoryRateLimit(r, "bucketB", RULES).allowed).toBe(true);
  });

  it("tracks IPs and buckets independently", async () => {
    const { memoryRateLimit } = await loadModule();
    for (let i = 0; i < 3; i++) memoryRateLimit(req("10.0.0.3"), "bucketC", RULES);
    expect(memoryRateLimit(req("10.0.0.3"), "bucketC", RULES).allowed).toBe(false);
    expect(memoryRateLimit(req("10.0.0.4"), "bucketC", RULES).allowed).toBe(true);
    expect(memoryRateLimit(req("10.0.0.3"), "bucketD", RULES).allowed).toBe(true);
  });

  it("denies without consuming quota when any rule would be exceeded", async () => {
    const { memoryRateLimit } = await loadModule();
    const rules = [
      { name: "burst", limit: 2, windowMs: 1_000 },
      { name: "day", limit: 100, windowMs: 86_400_000 },
    ];
    const r = req("10.0.0.6");
    memoryRateLimit(r, "bucketF", rules);
    memoryRateLimit(r, "bucketF", rules);
    expect(memoryRateLimit(r, "bucketF", rules).allowed).toBe(false);
    vi.advanceTimersByTime(1_100);
    expect(memoryRateLimit(r, "bucketF", rules).allowed).toBe(true);
  });
});

describe("rateLimit (durable)", () => {
  const RULES = [
    { name: "min", limit: 10, windowMs: 60_000 },
    { name: "day", limit: 50, windowMs: 86_400_000 },
  ];

  beforeEach(() => {
    queryMock.mockReset();
  });

  it("uses the database when DATABASE_URL is set", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    queryMock.mockImplementation(async (_sql, params) =>
      params[0].map((key) => ({ key, count: 1, retry_after: 60 })),
    );

    const result = await rateLimit(req("10.0.0.7"), "analyze", RULES);
    expect(result).toEqual({ allowed: true, durable: true });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("never sends the raw IP to the database", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    queryMock.mockImplementation(async (_sql, params) =>
      params[0].map((key) => ({ key, count: 1, retry_after: 60 })),
    );

    await rateLimit(req("203.0.113.9"), "analyze", RULES);
    const [, params] = queryMock.mock.calls[0];
    expect(JSON.stringify(params)).not.toContain("203.0.113.9");
    expect(params[0]).toHaveLength(2);
    expect(params[1]).toEqual([60_000, 86_400_000]);
  });

  it("keys differ per IP, per bucket, and per rule", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    queryMock.mockImplementation(async (_sql, params) =>
      params[0].map((key) => ({ key, count: 1, retry_after: 60 })),
    );

    await rateLimit(req("10.0.0.8"), "analyze", RULES);
    await rateLimit(req("10.0.0.9"), "analyze", RULES);
    await rateLimit(req("10.0.0.8"), "letter", RULES);

    const [ipA, ipB, otherBucket] = queryMock.mock.calls.map((c) => c[1][0]);
    expect(ipA[0]).not.toBe(ipB[0]); // different IP
    expect(ipA[0]).not.toBe(otherBucket[0]); // different bucket
    expect(ipA[0]).not.toBe(ipA[1]); // different rule
  });

  it("denies when only the short rule is exceeded", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    queryMock.mockImplementation(async (_sql, params) => [
      { key: params[0][0], count: 11, retry_after: 42 }, // over 10/min
      { key: params[0][1], count: 11, retry_after: 3600 }, // still under 50/day
    ]);

    const result = await rateLimit(req("10.0.0.10"), "analyze", RULES);
    expect(result.allowed).toBe(false);
    expect(result.durable).toBe(true);
    expect(result.retryAfterSec).toBe(42); // only the minute rule is blocking
  });

  it("reports the longest window when several rules block at once", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    queryMock.mockImplementation(async (_sql, params) => [
      { key: params[0][0], count: 11, retry_after: 42 },
      { key: params[0][1], count: 51, retry_after: 3600 },
    ]);

    const result = await rateLimit(req("10.0.0.14"), "analyze", RULES);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBe(3600);
  });

  it("allows when counts sit exactly on the limit", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    queryMock.mockImplementation(async (_sql, params) => [
      { key: params[0][0], count: 10, retry_after: 30 },
      { key: params[0][1], count: 10, retry_after: 30 },
    ]);
    expect((await rateLimit(req("10.0.0.11"), "analyze", RULES)).allowed).toBe(true);
  });

  it("degrades to the in-memory limiter when the query fails", async () => {
    const { rateLimit } = await loadModule({ databaseUrl: "postgres://stub" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error("neon unreachable"));

    const rules = [{ name: "min", limit: 2, windowMs: 60_000 }];
    const r = req("10.0.0.12");
    expect((await rateLimit(r, "analyze", rules)).durable).toBe(false);
    expect((await rateLimit(r, "analyze", rules)).allowed).toBe(true);
    // Still limits, just not across instances.
    expect((await rateLimit(r, "analyze", rules)).allowed).toBe(false);
  });

  it("falls back when DATABASE_URL is absent", async () => {
    const { rateLimit } = await loadModule();
    const result = await rateLimit(req("10.0.0.13"), "analyze", RULES);
    expect(result.durable).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
