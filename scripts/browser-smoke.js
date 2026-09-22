async (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/destinations", (route) =>
    route.fulfill({
      json: {
        places: [
          {
            id: "place_test",
            name: "検証用勤務先",
            address: "東京都テスト住所",
            url: "https://www.google.com/maps",
            attributions: [],
          },
        ],
      },
    }),
  );
  await page.route("**/api/commutes", (route) => {
    const b = route.request().postDataJSON();
    return route.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        destination: {
          name: "検証用勤務先",
          address: "東京都テスト住所",
          url: "https://www.google.com/maps",
        },
        schedule: b,
        candidates: b.candidates.map((c, i) => ({
          ...c,
          status: i === 2 ? "no_route" : "checked",
          url: "https://www.google.com/maps",
          recommended: i === 2 ? null : 0,
          routes:
            i === 2
              ? []
              : [
                  {
                    minutes: 25 + i * 10,
                    walkingMinutes: 5,
                    transfers: i,
                    lines: [],
                    fare: null,
                    warnings: [],
                  },
                ],
        })),
      },
    });
  });
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
  await page.locator("#destinationQuery").fill("新宿駅");
  await page.locator("#destinationForm button").click();
  await page.locator("[data-destination]").click();
  await page.locator("#commuteForm button").click();
  await page.locator("[data-commute-choice=fastest]").waitFor();
  if (
    !(await page.locator("#commuteResults").textContent()).includes(
      "対応する経路が返りませんでした",
    )
  )
    throw Error("partial failure missing");
  await page.locator("[data-commute-choice=walking]").click();
  await page.locator("[data-commute-level=prefer]").click();
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
  await page
    .locator("#observationForm textarea")
    .fill("ブラウザ検証用：夜の音を現地で確認");
  await page.locator("#observationForm button").click();
  await page.locator("#tab-needs").click();
  const memo = await page.locator("#memo").inputValue();
  for (const phrase of [
    "徒歩を少なく",
    "公園を週に数回",
    "週0日",
    "ブラウザ検証用",
  ])
    if (!memo.includes(phrase)) throw Error("memo missing " + phrase);
  await page.locator("#tab-sharing").click();
  if (
    (await page.locator("#sharePreview").textContent()).includes(
      "ブラウザ検証用",
    )
  )
    throw Error("own observation leaked by default");
  await page.locator("#shareObservations").check();
  if (
    !(await page.locator("#sharePreview").textContent()).includes(
      "ブラウザ検証用",
    )
  )
    throw Error("observation opt-in failed");
  if (
    (await page.locator("#sharePreview").textContent()).includes(
      "検証用：昼は静かでした。",
    )
  )
    throw Error("Provider review leaked into share preview");
  const download = page.waitForEvent("download");
  await page.locator("#exportBrief").click();
  await (await download).saveAs("output/playwright/brief-export.html");
  await page.locator("#shareObservations").uncheck();
  await page.locator("#createShare").click();
  await page.locator("#shareLinks a").first().waitFor();
  const link = await page.locator("#shareLinks a").first().getAttribute("href");
  const reader = await page.context().newPage();
  await reader.goto(link);
  await reader.locator("#sharedBrief h2").waitFor();
  if (
    (await reader.locator("#sharedBrief").textContent()).includes(
      "ブラウザ検証用",
    )
  )
    throw Error("shared private notes");
  await page.locator("[data-revoke-share]").first().click();
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
  await page.screenshot({
    path: "output/playwright/reviews-mobile-fixture.png",
    fullPage: true,
  });
  await page.locator("#workspaceSelect").selectOption("surroundings");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("access mobile overflow");
  await page.screenshot({ path: "output/playwright/features-mobile.png" });
};
