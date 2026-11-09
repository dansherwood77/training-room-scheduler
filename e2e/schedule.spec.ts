import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Morning Flow, Ana Ruiz/ })).toBeVisible();
});

test("opens the week on the seeded rooms and sessions", async ({ page }) => {
  await expect(page.getByRole("button", { name: "All rooms 4 rooms" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sun Room 18 people" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Drag to create or move a session.")).toBeVisible();
});

test("opens a session in the edit sheet and keeps it when cancel is declined", async ({ page }) => {
  await page.getByRole("button", { name: /Morning Flow, Ana Ruiz/ }).click();
  await expect(page.getByRole("heading", { name: "Edit session" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Edit session" })).toBeHidden();

  await page.getByRole("button", { name: "Delete Morning Flow" }).click();
  await expect(page.getByText("Cancel Morning Flow in Sun Room?")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("button", { name: /Morning Flow, Ana Ruiz/ })).toBeVisible();
});

test("fades the other rooms when one room is selected", async ({ page }) => {
  await page.getByRole("button", { name: "Palm Studio 12 people" }).click();
  await expect(page.getByRole("button", { name: /Morning Flow, Ana Ruiz/ })).toHaveClass(/dim/);
  await expect(page.getByRole("button", { name: /First Aid, Jordan Hale/ })).not.toHaveClass(/dim/);
});

test("day and month show the same seeded session", async ({ page }) => {
  await page.locator(".date-num").first().click();
  await expect(page.getByRole("button", { name: "Day", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".day-board").getByRole("button", { name: /Morning Flow, Ana Ruiz/ })).toBeVisible();

  await page.getByRole("button", { name: "Month", exact: true }).click();
  const month = page.getByRole("grid", { name: "Month" });
  await expect(month).toBeVisible();
  await expect(month.getByRole("gridcell", { name: /Morning Flow|\+\d+ more/ }).first()).toBeVisible();
});

test("books a free hour, refuses an overlap, and allows the next hour", async ({ page }) => {
  await openNewSession(page, 0.9);
  await fillSession(page, "Evening Drill", "20:00", "21:00");
  await page.getByRole("button", { name: "Book room" }).click();
  await expect(page.getByRole("button", { name: /Evening Drill, Ada Lovelace/ })).toBeVisible();

  await openNewSession(page, 0.94);
  await fillSession(page, "Late Drill", "20:30", "21:30");
  await page.getByRole("button", { name: "Book room" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Sun Room is already booked then, for Evening Drill with Ada Lovelace",
  );
  await page.getByRole("button", { name: "Close" }).click();

  await openNewSession(page, 0.94);
  await fillSession(page, "After Drill", "21:00", "22:00");
  await page.getByRole("button", { name: "Book room" }).click();
  await expect(page.getByRole("button", { name: /After Drill, Ada Lovelace/ })).toBeVisible();
});

test("adds a room and cancels it after a confirm", async ({ page }) => {
  await page.getByRole("button", { name: "+ Add a room" }).click();
  await expect(page.getByRole("heading", { name: "New room" })).toBeVisible();
  await page.getByLabel("Name").fill("North Lawn");
  await page.getByLabel("Capacity").fill("6");
  await page.getByRole("button", { name: "Add room" }).click();
  await expect(page.getByRole("button", { name: "North Lawn 6 people" })).toBeVisible();

  await page.locator(".room", { hasText: "North Lawn" }).getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Cancel room" }).click();
  await expect(page.getByText("Cancel North Lawn? This room has no bookings.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel room" }).click();
  await expect(page.getByRole("button", { name: "North Lawn 6 people" })).toBeHidden();
});

async function openNewSession(page: Page, downTheDay: number) {
  const column = page.locator(".day-col").first();
  await expect(column).toBeVisible();
  const box = await column.boundingBox();
  if (!box) throw new Error("The Sunday column is not on screen.");
  await column.click({ position: { x: Math.max(12, box.width / 2), y: Math.max(24, box.height * downTheDay) } });
  await expect(page.getByRole("heading", { name: "New session" })).toBeVisible();
}

async function fillSession(page: Page, title: string, start: string, end: string) {
  const sheet = page.getByRole("dialog", { name: "New session" });
  await sheet.getByRole("textbox", { name: "Session" }).fill(title);
  await sheet.getByRole("textbox", { name: "Instructor" }).fill("Ada Lovelace");
  await sheet.getByRole("combobox", { name: "Room" }).selectOption({ label: "Sun Room" });
  await sheet.getByRole("textbox", { name: "Start time" }).fill(start);
  await sheet.getByRole("textbox", { name: "End time" }).fill(end);
}
