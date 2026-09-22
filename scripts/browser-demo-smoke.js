// Static player checks: no API or provider requests.
async (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4174/demo/#chapter=5");
  await page.locator("#chapters button").first().waitFor();
  await page.waitForFunction(
    () => document.querySelector("#film").readyState >= 1,
  );
  if ((await page.locator("#chapters button").count()) !== 13)
    throw Error("Thirteen chapters required");
  await page.waitForFunction(() =>
    document
      .querySelectorAll('#chapters button[aria-current="true"]')[0]
      ?.textContent.includes("commute"),
  );
  const initial = await page.locator("#film").evaluate((film) => ({
    duration: film.duration,
    paused: film.paused,
    time: film.currentTime,
    width: film.videoWidth,
    height: film.videoHeight,
  }));
  if (
    !initial.paused ||
    initial.time < 20 ||
    initial.duration < 60 ||
    initial.width !== 1440 ||
    initial.height !== 1000
  )
    throw Error(
      "Invalid media or deep-link behavior: " + JSON.stringify(initial),
    );
  await page.locator("#chapters button").nth(2).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#film").paused);
  await page.waitForFunction(
    () =>
      document.querySelector("#film").readyState >= 2 &&
      document.querySelector("#film").currentTime > 17,
  );
  await page.locator("#film").evaluate((film) => film.pause());
  await page.locator("#film").evaluate((film) => {
    for (const track of film.textTracks) track.mode = "hidden";
  });
  await page.waitForFunction(() =>
    [...document.querySelector("#film").textTracks].every(
      (track) => track.cues?.length === 13,
    ),
  );
  await page.locator("details summary").click();
  if (
    (await page.locator("#transcript h3").count()) !== 13 ||
    (await page.locator('#transcript p[lang="ja"]').count()) !== 13
  )
    throw Error("Bilingual transcript incomplete");
  await page.locator("details summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "output/playwright/demo-player-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Demo player overflow at " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/demo-player-mobile.png",
    fullPage: true,
  });
  const response = await page.request.get(
    "http://127.0.0.1:4174/demo/media/walkthrough.mp4",
  );
  if (
    !response.ok() ||
    !response.headers()["content-type"].includes("video/mp4")
  )
    throw Error("Video download must work");
  if (errors.length) throw Error(errors.join("; "));
};
