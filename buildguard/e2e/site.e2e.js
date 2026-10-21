import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  ["/", /Check your medical bill against Medicare rates/],
  ["/analyze", "Analyze a bill | MedBill Analyzer"],
  ["/how-it-works", "How it works | MedBill Analyzer"],
  ["/faq", "FAQ | MedBill Analyzer"],
  ["/privacy", "Consumer Health Data Privacy Policy | MedBill Analyzer"],
  ["/about", "About | MedBill Analyzer"],
];

for (const [path, title] of PAGES) {
  test(`${path} deep-links, sets its title, and has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("unknown routes render the 404 page", async ({ page }) => {
  await page.goto("/definitely-not-a-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("client-side navigation moves focus to main content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveTitle("FAQ | MedBill Analyzer");
  await expect(page.locator("main")).toBeFocused();
});

test("mobile menu opens and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "Primary mobile" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test("skip link is the first tab stop and targets main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute("href", "#main");
});
