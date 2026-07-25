import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function expectNoSeriousA11yViolations(page: Page, surface: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    serious,
    `${surface}: ${serious.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("; ")}`,
  ).toEqual([]);
}
