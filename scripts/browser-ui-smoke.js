// Native interaction checks. No provider calls, credentials, or fixture preferences needed.
async (page) => {
  const reviewStub = (route) =>
    route.fulfill({
      json: {
        status: "no_sources",
        reviews: [],
        otherPages: [],
        sourceCount: 0,
        checkedAt: "2026-09-22T10:00:00Z",
        searchSuggestions: "",
      },
    });
  await page.route("**/api/reviews/web", reviewStub);
  const errors = [];
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  page.on("pageerror", (error) => errors.push(error.message));
  const activeId = () => page.evaluate(() => document.activeElement.id);
  const open = (selector) => page.locator(selector).evaluate((el) => el.open);
  const settled = async (target) =>
    target.evaluate(async (el) => {
      await Promise.allSettled(
        el.getAnimations().map((animation) => animation.finished),
      );
    });

  await page.locator("#compareRows .cell").first().waitFor();
  const views = [
    "compare",
    "commute",
    "surroundings",
    "leisure",
    "reviews",
    "scenarios",
    "needs",
    "sharing",
  ];
  for (const view of views) {
    await page.locator(`#tab-${view}`).click();
    check(
      await page.locator(`#panel-${view}`).isVisible(),
      `${view} has a directly accessible page`,
    );
    check(
      (await page.locator('#workspaceTabs [aria-selected="true"]').count()) ===
        1,
      "Exactly one feature tab is selected",
    );
    check(
      (await page.locator("#workspaceSelect").inputValue()) === view,
      "Mobile navigation mirrors desktop state",
    );
  }
  // Navigation changes visibility only: form drafts must not be recreated or reset.
  await page.locator("#tab-commute").click();
  await page.locator("#destinationQuery").fill("未検索の勤務先");
  await page.locator("#tab-leisure").click();
  await page.goBack();
  await page.locator("#panel-commute").waitFor();
  check(
    (await page.locator("#destinationQuery").inputValue()) === "未検索の勤務先",
    "Back restores the view and preserves its draft",
  );
  await page.goForward();
  await page.locator("#panel-leisure").waitFor();
  await page.locator("#tab-reviews").focus();
  await page.keyboard.press("ArrowRight");
  check(
    (await activeId()) === "tab-scenarios",
    "Feature tabs support arrow-key navigation",
  );
  await page.reload();
  await page.locator("#panel-scenarios").waitFor();
  await page.goto("http://127.0.0.1:4173/#commuteSection");
  await page.locator("#destinationQuery").waitFor();
  await page.locator("#tab-compare").click();
  // A new link has no candidate or research fingerprint yet.
  await page.locator("#addLink").click();
  check(
    await open("#researchDialog"),
    "New-link intake opens without an existing candidate",
  );
  check(
    await page.locator("#linkFallback").isVisible(),
    "New-link intake offers saving an unparsed link",
  );
  await page.keyboard.press("Escape");
  check(
    (await activeId()) === "addLink",
    "Link intake restores focus to its trigger",
  );
  const more = page.locator(".more-inputs > summary");
  await more.click();
  await page.keyboard.press("Escape");
  check(
    !(await open(".more-inputs")),
    "Escape closes additional input options",
  );
  check(
    await more.evaluate((el) => el === document.activeElement),
    "Escape restores disclosure focus",
  );
  await more.click();
  await page.locator("#compareTitle").click();
  check(
    !(await open(".more-inputs")),
    "Outside click closes additional input options",
  );

  await page.locator("#perspective-cost").focus();
  await page.keyboard.press("ArrowRight");
  check(
    (await activeId()) === "perspective-space",
    "Arrow key selects and focuses the next perspective",
  );
  await page.keyboard.press("Home");
  check((await activeId()) === "perspective-cost", "Home returns to cost view");
  const cell = page.locator('#compareRows .cell[data-row="monthly"]').first();
  await cell.focus();
  await page.keyboard.press("Enter");
  check(await open("#cellPopover"), "Keyboard opens the source panel");
  check(
    await page
      .locator("#cellPopover")
      .evaluate((el) => getComputedStyle(el).transitionDuration === "0s"),
    "Keyboard opens without motion",
  );
  await page.keyboard.press("Escape");
  check(
    await cell.evaluate((el) => el === document.activeElement),
    "Source panel returns focus to the value",
  );

  await cell.click();
  check(
    await page
      .locator("#cellPopover")
      .evaluate(
        (el) => parseFloat(getComputedStyle(el).transitionDuration) > 0,
      ),
    "Pointer open has a short transition",
  );
  await page.locator("#popoverClose").click();
  await settled(page.locator("#cellPopover"));
  check(
    !(await open("#cellPopover")),
    "Pointer close releases the native modal",
  );
  // A rapid close/reopen must not leave a stale top layer, invisible panel, or stolen focus.
  await cell.click();
  await page.keyboard.press("Escape");
  await cell.click();
  check(await open("#cellPopover"), "A dismissed panel can reopen immediately");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await cell.click();
  check(
    await page
      .locator("#cellPopover")
      .evaluate(
        (el) =>
          getComputedStyle(el).transitionDuration === "0s" &&
          el.getAnimations().length === 0,
      ),
    "Reduced motion disables overlay animation",
  );
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Resizing an open and a closed sheet both restore the same content to the inspector.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#guideOpen").click();
  check(await open("#guideDialog"), "Mobile question panel opens");
  await page.keyboard.press("Escape");
  check(
    (await activeId()) === "guideOpen",
    "Sheet returns focus to its trigger",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#guidePanel #guideContent").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#guideOpen").click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#guidePanel #guideContent").waitFor();
  check(!(await open("#guideDialog")), "Desktop resize releases an open sheet");

  const touch = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      colorScheme: "light",
    });
  try {
    await touch.route("**/api/reviews/web", reviewStub);
    const phone = await touch.newPage();
    phone.on("pageerror", (error) => errors.push(error.message));
    await phone.goto("http://127.0.0.1:4173");
    await phone.locator("#compareRows .cell").first().waitFor();
    for (const width of [320, 390, 760]) {
      await phone.setViewportSize({ width, height: 844 });
      check(
        await phone.evaluate(
          (viewportWidth) =>
            document.documentElement.scrollWidth <= viewportWidth,
          width,
        ),
        `No document overflow at ${width}px`,
      );
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    for (const width of [320, 390, 760]) {
      await phone.setViewportSize({ width, height: 844 });
      for (const view of views) {
        await phone.locator("#workspaceSelect").selectOption(view);
        check(
          await phone.locator(`#panel-${view}`).isVisible(),
          `Mobile dropdown reaches ${view}`,
        );
        check(
          await phone.evaluate(
            (w) => document.documentElement.scrollWidth <= w,
            width,
          ),
          `${view} fits ${width}px`,
        );
      }
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.locator("#workspaceSelect").selectOption("compare");
    check(
      await phone
        .locator("#pairFirst")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
      "Touch candidate selectors are at least 16px",
    );
    await phone.locator("#perspective-access").tap();
    await phone.locator('[data-open-feature="commuteSection"]').tap();
    const form = phone.locator("#commuteForm");
    check(
      await form
        .locator("input, select")
        .evaluateAll((els) =>
          els.every((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
        ),
      "Touch form fields remain at least 16px inside small labels",
    );
    check(
      await phone.evaluate(() => document.documentElement.scrollWidth <= 390),
      "Expanded commute form fits phone width",
    );
    await phone.locator("#workspaceSelect").selectOption("compare");
    await phone.locator("#guideOpen").tap();
    await phone.locator("#guideClose").tap();
    await settled(phone.locator("#guideDialog"));
    check(
      await phone.locator("#guideDialog").evaluate((el) => !el.open),
      "Touch sheet closes after the exit transition",
    );
    await phone.locator("#guideOpen").tap();
    await phone.locator("#guide-ai").tap();
    check(
      await phone.locator("#aiGuide").isVisible(),
      "Reopened sheet retains interactive content",
    );
    await phone.keyboard.press("Escape");
    await phone.emulateMedia({ colorScheme: "dark" });
    check(
      await phone
        .locator("body")
        .evaluate(
          (el) => getComputedStyle(el).backgroundColor === "rgb(19, 28, 24)",
        ),
      "Dark scheme uses the matching surface",
    );
  } finally {
    await touch.close();
  }
  check(errors.length === 0, errors.join("\n"));
  console.log(
    "UI checks passed: keyboard/focus, native dialog transitions, interruption, reduced motion, responsive restoration, touch forms, and dark scheme. Real phone checks remain separate.",
  );
};
