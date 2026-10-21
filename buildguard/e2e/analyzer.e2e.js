import { expect, test } from "@playwright/test";

// What /api/analyze returns for the mocked bill: one line in each status band.
const ANALYZE_OK = {
  status: "ok",
  request_id: "e2e",
  line_items_found: 4,
  line_items: [
    { code: "99213", charged: 250, found_in_fee_schedule: true, rate_source: "physician_fee_schedule", medicare_rate: 91, overcharge_amount: 159, overcharge_multiple: 2.75 },
    { code: "70450", charged: 1450, found_in_fee_schedule: true, rate_source: "physician_fee_schedule", medicare_rate: 106.55, overcharge_amount: 1343.45, overcharge_multiple: 13.61 },
    { code: "85025", charged: 12, found_in_fee_schedule: true, rate_source: "clinical_lab_fee_schedule", medicare_rate: 7.77, overcharge_amount: 4.23, overcharge_multiple: 1.54 },
    { code: "99999", charged: 80, found_in_fee_schedule: false, rate_source: null, medicare_rate: null, overcharge_amount: null, overcharge_multiple: null },
  ],
};

const BILL = { name: "bill.png", mimeType: "image/png", buffer: Buffer.from("\x89PNG\r\n\x1a\nfake") };

function mockApi(page, route, { status = 200, json, body, contentType } = {}) {
  const requests = [];
  page.route(`**/api/${route}`, (r) => {
    requests.push(r.request());
    return json !== undefined ? r.fulfill({ status, json }) : r.fulfill({ status, body, contentType });
  });
  return requests;
}

async function upload(page, file = BILL) {
  await page.goto("/analyze");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText(`Selected: ${file.name}`)).toBeVisible();
}

test("upload -> results -> dispute letter, end to end", async ({ page }) => {
  const analyzeCalls = mockApi(page, "analyze", { json: ANALYZE_OK });
  const letterCalls = mockApi(page, "generate-letter", { json: { status: "ok", request_id: "e2e", letter: "Dear Billing Office,\n\nI am writing to request a review." } });

  await page.goto("/");
  await page.getByRole("link", { name: "Analyze a bill" }).first().click();
  await expect(page).toHaveURL(/\/analyze$/);
  await expect(page.getByRole("button", { name: "Analyze bill" })).toBeDisabled();

  await upload(page);
  await page.getByRole("button", { name: "Analyze bill" }).click();

  await expect(page.getByText("Analysis complete: 4 line items, 3 checked against CMS rates.")).toBeVisible();
  expect(analyzeCalls[0].headers()["content-type"]).toContain("multipart/form-data");

  const rows = page.getByRole("region", { name: /Line items compared/ }).locator("tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Above reference");
  await expect(rows.nth(1)).toContainText("Far above reference");
  await expect(rows.nth(2)).toContainText("Near reference");
  await expect(rows.nth(3)).toContainText("Unverified");
  await expect(page.getByText("13.6×")).toBeVisible(); // "Highest vs. reference" summary
  await expect(page.getByText("3 / 4")).toBeVisible();

  await page.getByLabel("Your name").fill("Jane Doe");
  await page.getByRole("button", { name: "Generate dispute letter" }).click();

  const letter = page.getByLabel("Generated dispute letter");
  await expect(letter).toContainText("I am writing to request a review.");
  await expect(letter).toBeFocused(); // keyboard / screen-reader users land on it
  const sent = letterCalls[0].postDataJSON();
  expect(sent.patient_name).toBe("Jane Doe");
  expect(sent.line_items.map((li) => li.code)).toEqual(["99213", "70450", "85025", "99999"]);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  expect((await download).suggestedFilename()).toBe("dispute-letter.txt");
});

test("files over 4 MB are refused in the browser without an upload", async ({ page }) => {
  const calls = mockApi(page, "analyze", { json: ANALYZE_OK });
  await upload(page, { name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });

  await expect(page.getByRole("alert")).toContainText("That file is too large to upload");
  await page.getByRole("button", { name: "Analyze bill" }).click();
  expect(calls).toHaveLength(0);
});

test("Vercel's plain-text 413 becomes the friendly size message, not a JSON error", async ({ page }) => {
  mockApi(page, "analyze", { status: 413, body: "Request Entity Too Large", contentType: "text/plain" });
  await upload(page);
  await page.getByRole("button", { name: "Analyze bill" }).click();
  await expect(page.getByRole("alert")).toContainText("the limit is 4 MB");
});

test("backend error detail is shown to the user (e.g. rate limited)", async ({ page }) => {
  mockApi(page, "analyze", { status: 429, json: { detail: "Too many requests. Try again in a minute." } });
  await upload(page);
  await page.getByRole("button", { name: "Analyze bill" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many requests. Try again in a minute.");
});

test("no verified overcharge means no letter button", async ({ page }) => {
  mockApi(page, "analyze", { json: { ...ANALYZE_OK, line_items: [ANALYZE_OK.line_items[3]], line_items_found: 1 } });
  await upload(page);
  await page.getByRole("button", { name: "Analyze bill" }).click();
  await expect(page.getByText(/nothing here for a letter to\s+argue/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate dispute letter" })).toHaveCount(0);
});

test("an empty extraction shows guidance instead of a table", async ({ page }) => {
  mockApi(page, "analyze", { json: { status: "ok", request_id: "e2e", line_items: [], line_items_found: 0 } });
  await upload(page);
  await page.getByRole("button", { name: "Analyze bill" }).click();
  await expect(page.getByText("No billing line items found")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
