// Deliberate holds make the captioned silent film readable. Not a timing benchmark.
async (page) => {
  const chapters = [];
  const started = Date.now();
  const hold = (ms) => page.waitForTimeout(ms);
  async function chapter(title, subtitle) {
    chapters.push({
      title,
      caption: subtitle,
      start: (Date.now() - started) / 1000,
    });
    await page.evaluate(
      ({ title, subtitle, count }) => {
        const caption = document.querySelector("#film-caption");
        caption.querySelector("small").textContent =
          `RENTAL HELPER / ${String(count).padStart(2, "0")} / SIMULATED WALKTHROUGH`;
        caption.querySelector("strong").textContent = title;
        caption.querySelector("p").textContent = subtitle;
      },
      { title, subtitle, count: chapters.length },
    );
  }
  async function click(selector) {
    const target = page.locator(selector).first();
    await target.scrollIntoViewIfNeeded();
    await target.hover();
    await hold(350);
    await target.click();
  }
  await chapter(
    "Compare the homes you are already considering.",
    "Recorded listing images become a side-by-side view. No requirements essay to get started.",
  );
  await hold(5500);
  await chapter(
    "A reference price is not a confirmed rent.",
    "Inspect the source and room identity. Another unit's offer stays outside the budget calculation.",
  );
  await click('#compareRows .cell[data-row="monthly"] >> nth=2');
  await page.locator("#cellPopover").waitFor();
  await hold(6000);
  await click("#popoverClose");
  await chapter(
    "Let the candidates start the conversation.",
    "This AI exchange is scripted for the demo. The interface, evidence controls and actions are real.",
  );
  await click("#guide-ai");
  await click("#advisorStart");
  await page.locator("[data-advisor-answer]").first().waitFor();
  await page
    .locator("#advisorQuestion")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await hold(6500);
  await chapter(
    "Choose a direction. Confirm the interpretation.",
    "A tentative answer is not a saved requirement. Only your confirmation changes the comparison.",
  );
  await click("[data-advisor-answer]");
  await page.locator("[data-confirm-proposal]").waitFor();
  await page.locator(".advisor-proposal").scrollIntoViewIfNeeded();
  await hold(4500);
  await click("[data-confirm-proposal]");
  await page.locator("#discoveredPriorities").scrollIntoViewIfNeeded();
  await hold(4500);
  await chapter(
    "Check the commute without retyping every address.",
    "Tokyo hub menu + outbound/return Maps links. Set the 08:00 / 18:00 schedule inside Google Maps.",
  );
  await click("#tab-commute");
  await page.locator("#commuteResults").scrollIntoViewIfNeeded();
  await hold(5000);
  await page.locator("#destinationPreset").selectOption("shinjuku");
  await page.locator("#commuteResults").scrollIntoViewIfNeeded();
  await page.locator('[data-commute-link="outbound"]').first().hover();
  await hold(4500);
  await chapter(
    "Leave with a brief you can explain.",
    "Confirmed priorities and unanswered questions are assembled automatically. No manual diary.",
  );
  await click("#tab-needs");
  await hold(5500);
  await page.locator("#memo").evaluate((el) => (el.scrollTop = 180));
  await hold(2000);
  await chapter(
    "Preview what leaves your browser.",
    "Review the content, then save an HTML brief. Hosted share links need a connected backend.",
  );
  await click("#tab-sharing");
  await hold(5000);
  const pending = page.waitForEvent("download");
  await click("#exportBrief");
  await (await pending).saveAs("output/playwright/demo-brief.html");
  await hold(3000);
  await chapter(
    "Explore the product. Then inspect the engineering.",
    "Try the public demo, follow the code tour, or run the project locally. Links are in the README.",
  );
  await click("#tab-compare");
  await page.evaluate(() => window.scrollTo(0, 0));
  await hold(4000);
  return { chapters, duration: (Date.now() - started) / 1000 };
};
