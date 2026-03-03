import { expect, test } from "@playwright/test";

const MOCK_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("generate panel, open editor, add bubble, export png", async ({ page }) => {
  await page.route("**/api/models", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ models: ["google/gemini-2.5-flash-image"], source: "mock" })
    });
  });

  await page.route("**/api/panel/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageDataUrl: MOCK_IMAGE_DATA_URL, text: "ok" })
    });
  });

  await page.goto("/");

  await page.getByLabel("Project title").fill("E2E Comic");
  await page.getByLabel("Panel prompt").fill("A masked hero jumps between rooftops at night.");
  await page.getByRole("button", { name: "Generate panel" }).click();

  await expect(page.getByText("Panel image generated successfully.")).toBeVisible();
  await expect(page.getByAltText("Panel 1 preview")).toBeVisible();

  await page.getByRole("link", { name: "Edit page" }).click();

  const addBubbleButton = page.getByRole("button", { name: "Add bubble" });
  await expect(addBubbleButton).toBeEnabled();
  await addBubbleButton.click();

  await expect(page.getByRole("button", { name: /Bubble 1/ })).toBeVisible();

  await page.getByRole("button", { name: /Bubble 1/ }).click();
  await page.getByLabel("Preset").selectOption("shout");
  await page.getByLabel("Tail side").selectOption("left");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click()
  ]);

  expect(download.suggestedFilename()).toContain("e2e-comic");
});
