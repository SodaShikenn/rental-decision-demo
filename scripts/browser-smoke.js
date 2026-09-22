async (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let commuteApiRequests = 0;
  for (const endpoint of ["destinations", "commutes"]) {
    await page.route(`**/api/${endpoint}`, (route) => {
      commuteApiRequests++;
      return route.abort();
    });
  }
  await page.route("**/api/leisure", (route) => {
    const b = route.request().postDataJSON();
    return route.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        radiusMeters: 1500,
        destination: null,
        candidates: b.candidates.map((c) => ({
          ...c,
          status: "checked",
          groups: [
            {
              kind: "park",
              places: [
                {
                  id: "park_test",
                  name: "検証用公園",
                  address: "公開テスト住所",
                  url: "https://www.google.com/maps",
                  businessStatus: "OPERATIONAL",
                  route: { minutes: 8, meters: 600 },
                  routeUrl: "https://www.google.com/maps",
                  hours: [],
                  attributions: [],
                },
              ],
            },
          ],
        })),
      },
    });
  });
  let reviewRequests = 0;
  await page.route("**/api/reviews/web", (route) => {
    reviewRequests++;
    if (reviewRequests === 2)
      return route.fulfill({
        json: {
          status: "found",
          tier: "nearby",
          sourceCount: 1,
          checkedAt: new Date().toISOString(),
          reviews: [
            {
              text: "検証用：近隣の建物での静かという声。",
              scope: "nearby_building",
              room: "",
              publishedDate: null,
              sourceTitle: "検証用の出典",
              url: "https://example.com/neighbor-review",
              reference: {
                name: "検証用の近隣マンション",
                address: "東京都テスト区1-2-3",
                distanceMeters: 80,
                url: "https://maps.google.com",
                attributions: [],
              },
            },
          ],
          otherPages: [],
          searchSuggestions: [],
        },
      });
    if (reviewRequests === 3)
      return route.fulfill({
        json: {
          status: "no_reviews",
          tier: "none",
          sourceCount: 0,
          reviews: [],
          otherPages: [],
          searchSuggestions: [],
        },
      });
    return route.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        status: "found",
        sourceCount: 1,
        otherPages: [
          {
            title: "検証用募集ページ",
            url: "https://example.com/listing",
            reason: "募集ページです",
          },
        ],
        reviews: [
          {
            text: "検証用：昼は静かでした。",
            scope: "same_building",
            publishedDate: null,
            sourceTitle: "検証用口コミサイト",
            url: "https://example.com/review",
          },
        ],
      },
    });
  });
  await page.locator("#tab-commute").click();
  if ((await page.locator("#destinationPreset").inputValue()) !== "shibuya")
    throw Error("Shibuya should be suggested for these candidates");
  if (
    (await page.locator("[name=morning]").inputValue()) !== "08:00" ||
    (await page.locator("[name=evening]").inputValue()) !== "18:00"
  )
    throw Error("Morning/evening defaults missing");
  const outbound = page.locator('[data-commute-link="outbound"]');
  const returning = page.locator('[data-commute-link="return"]');
  if ((await outbound.count()) !== 3 || (await returning.count()) !== 3)
    throw Error(
      "Each candidate needs immediately available outbound/return links",
    );
  const linkData = (link) =>
    link.evaluate((el) => ({
      href: el.href,
      ...Object.fromEntries(new URL(el.href).searchParams),
    }));
  const outgoing = await linkData(outbound.first());
  const incoming = await linkData(returning.first());
  if (
    outgoing.origin !== incoming.destination ||
    outgoing.destination !== incoming.origin
  )
    throw Error("Return endpoints must be reversed");
  if (
    outgoing.destination !== "東京都 渋谷駅" ||
    outgoing.travelmode !== "transit"
  )
    throw Error("Default destination/mode missing");
  if (
    !(await page.locator("#commuteTimeNotice").textContent()).includes(
      "日時は引き継げない",
    )
  )
    throw Error("Time limitation must be visible");
  await page.locator("#destinationPreset").selectOption("shinjuku");
  if ((await linkData(outbound.first())).destination !== "東京都 新宿駅")
    throw Error("Preset must update links immediately");
  await page.locator("#destinationPreset").selectOption("custom");
  if (await outbound.count())
    throw Error("Empty destination must not launch a blank Maps route");
  await page.locator("#destinationQuery").fill("東京都 新宿駅 西口 & 南口");
  await page.locator("#commuteForm [name=mode]").selectOption("walking");
  const custom = await linkData(outbound.first());
  if (
    custom.destination !== "東京都 新宿駅 西口 & 南口" ||
    custom.travelmode !== "walking"
  )
    throw Error("Custom destination and mode must be encoded independently");
  // Exercise the external-tab action without making a live Google request.
  await page
    .context()
    .route("https://www.google.com/maps/**", (route) =>
      route.fulfill({ body: "Maps handoff test" }),
    );
  const popupPromise = page.waitForEvent("popup");
  await outbound.first().click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  if (popup.url() !== custom.href) throw Error("Wrong Maps handoff URL");
  await popup.close();
  if (commuteApiRequests)
    throw Error("Maps links must work without backend/provider requests");
  await page.locator("#tab-scenarios").click();
  if (
    !(await page.locator("#scenarioResults").textContent()).includes(
      "検索結果は自動取得されません",
    )
  )
    throw Error("External navigation must not become a verified route");
  await page.locator("#tab-leisure").click();
  await page.locator("#discoverLeisure").click();
  await page.locator("[data-interest=park]").click();
  await page.locator("#leisurePreferenceForm button").click();
  await page.locator("#tab-scenarios").click();
  await page.locator("#scenarioDays").selectOption("0");
  if (
    !(await page.locator("#scenarioResults").textContent()).includes(
      "往路合計：0分",
    )
  )
    throw Error("remote scenario");
  await page.locator("#scenarioForm button").click();
  await page.locator("#tab-reviews").click();
  await page.locator("#reviewResults .review-entry").waitFor();
  if (reviewRequests !== 1)
    throw new Error("Review page must automatically search once");
  await page.locator("#tab-compare").click();
  await page.locator("#tab-reviews").click();
  if (reviewRequests !== 1)
    throw new Error("Review navigation must reuse session results");
  await page.locator("[data-review-topic=sound]").click();
  if (await page.locator("#observationForm, #advisorReplyForm").count())
    throw Error("Manual requirement inputs must be removed");
  await page.locator("#tab-needs").click();
  const memo = await page.locator("#memo").textContent();
  for (const phrase of ["公園を週に数回", "週0日"])
    if (!memo.includes(phrase)) throw Error("memo missing " + phrase);
  if (
    (await page
      .locator("#memo")
      .evaluate((el) => getComputedStyle(el).whiteSpace)) !== "pre-wrap"
  )
    throw Error("Generated brief must preserve paragraph and list breaks");
  await page.locator("#copyMemo").click();
  await page.getByText("コピーしました", { exact: true }).waitFor();
  await page.locator("#tab-sharing").click();
  if (await page.locator("#shareObservations").count())
    throw Error("Retired notes must not be shareable");
  if (
    await page
      .locator("#memo")
      .evaluate((el) => el.matches("textarea, input, [contenteditable=true]"))
  )
    throw Error("Decision brief must be generated and read-only");
  if (
    (await page.locator("#sharePreview").textContent()).includes(
      "検証用：昼は静かでした。",
    )
  )
    throw Error("Review text leaked into share");
  const download = page.waitForEvent("download");
  await page.locator("#exportBrief").click();
  await (await download).saveAs("output/playwright/brief-export.html");
  await page.locator("#createShare").click();
  await page.locator("#shareLinks a").first().waitFor();
  const link = await page.locator("#shareLinks a").first().getAttribute("href");
  const reader = await page.context().newPage();
  await reader.goto(link);
  await reader.locator("#sharedBrief h2").waitFor();
  if (
    (await reader.locator("#sharedBrief").textContent()).includes(
      "検証用：昼は静かでした。",
    )
  )
    throw Error("provider review leaked into shared brief");
  const [revoked] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith("/api/shares/revoke"),
    ),
    page.locator("[data-revoke-share]").first().click(),
  ]);
  if (!revoked.ok())
    throw Error(`Share revocation failed: ${revoked.status()}`);
  await reader.reload();
  await reader
    .getByText("共有が見つからないか、期限切れ・削除済みです。", {
      exact: true,
    })
    .waitFor();
  await reader.close();
  if (errors.length) throw Error(errors.join(";"));
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("share mobile overflow");
  await page.locator("#workspaceSelect").selectOption("reviews");
  await page.locator("#reviewResults .review-entry").waitFor();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Review results mobile overflow");
  await page.locator("#reviewSearch").click();
  await page.locator(".review-reference").waitFor();
  if (
    !(await page.locator("#reviewResults").textContent()).includes("直線 約80m")
  )
    throw Error("Nearby distance missing");
  if (
    !(await page.locator("#reviewResults").textContent()).includes(
      "この候補に当てはめることはできません",
    )
  )
    throw Error("Nearby evidence was not distinguished");
  await page.screenshot({
    path: "output/playwright/reviews-mobile-fixture.png",
    fullPage: true,
  });
  await page.locator("#reviewSearch").click();
  await page.getByText("検索済み", { exact: true }).waitFor();
  if ((await page.locator("#reviewResults").textContent()).trim())
    throw Error("Empty search must leave reviews blank");
  await page.locator("#workspaceSelect").selectOption("surroundings");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("access mobile overflow");
  await page.screenshot({ path: "output/playwright/features-mobile.png" });
};
