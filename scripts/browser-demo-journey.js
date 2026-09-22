// Real provider calls, real UI actions. No response interception or canned replies.
async (page) => {
  const chapters = [],
    requests = [];
  const started = Date.now();
  const hold = (ms = 3500) => page.waitForTimeout(ms);
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests.push(Date.now());
  });
  async function pace() {
    const recent = requests.filter((t) => Date.now() - t < 61000);
    if (recent.length >= 4)
      await hold(61500 - (Date.now() - recent[recent.length - 4]));
  }
  async function chapter(label, title, caption, ja) {
    chapters.push({
      label,
      title,
      caption,
      ja,
      start: (Date.now() - started) / 1000,
    });
    await page.evaluate(
      ({ title, caption }) => {
        document.querySelector("#film-caption strong").textContent = title;
        document.querySelector("#film-caption p").textContent = caption;
      },
      { title, caption },
    );
  }
  async function click(selector) {
    const target = page.locator(selector).first();
    await target.scrollIntoViewIfNeeded();
    await target.hover();
    await hold(250);
    await target.click();
  }
  async function live(path, action, timeout = 190000) {
    await pace();
    // Bind to the request started by this action, not an older automatic search.
    const pending = page.waitForRequest(
      (r) => r.url().includes(path) && r.method() === "POST",
      { timeout },
    );
    await action();
    const request = await pending;
    const response = await request.response();
    if (!response) throw Error(`${path}: request failed`);
    await response.finished();
    if (!response.ok()) throw Error(`${path}: ${response.status()}`);
    await hold(1200);
    return response;
  }
  async function removeLast() {
    const column = page.locator("#compareHead th[data-property]").last();
    await column.locator("summary").click();
    await column.locator("[data-remove]").click();
  }
  await chapter(
    "Compare candidates",
    "Compare the homes you already found.",
    "Three recorded listings; source dates and unknown values stay visible.",
    "検討中の候補から比較します。掲載時点と未取得の情報を区別します。",
  );
  await hold(5000);
  await click('#compareRows .cell[data-row="monthly"] >> nth=2');
  await hold();
  await click("#popoverClose");

  await chapter(
    "Import an image",
    "Add a listing image. Inspect what was extracted.",
    "Live OCR and Gemini analysis; uncertain fields need confirmation.",
    "図面を実際に解析します。読み取りが不確かな値は確認が必要です。",
  );
  await page
    .locator("#listingUpload")
    .setInputFiles("web/static/sheets/louvre-shoto.jpg");
  await hold();
  await live("/api/extract", () => click("#analyzeListing"));
  await page.locator('#intakeDialog[data-state="review"]').waitFor();
  await hold(6000);
  await click("#confirmExtraction");
  await hold();
  await removeLast();

  await chapter(
    "Import a listing link",
    "Research a listing link across sources.",
    "A real SUUMO building URL; choose sourced fields before adding a candidate.",
    "SUUMOのリンクを調査し、出典を確認して候補に追加します。",
  );
  await click("#addLink");
  await page
    .locator("#researchUrl")
    .fill("https://suumo.jp/library/tf_13/sc_13113/to_1001333982/?bs=040");
  await live("/api/research-listing", () => click("#researchRun"));
  await page.waitForFunction(
    () => !document.querySelector("#researchRun").disabled,
  );
  await page.locator("#researchResults article").first().waitFor();
  await hold(5000);
  const result = page
    .locator("#researchResults form")
    .filter({ has: page.locator('input[name="fact"]:enabled') })
    .first();
  const facts = result.locator('input[name="fact"]:enabled');
  for (let i = 0; i < (await facts.count()); i++) await facts.nth(i).check();
  await result.locator('button[type="submit"]').click();
  await hold();
  await removeLast();

  await chapter(
    "Research missing rent",
    "Look for missing rent without mixing up rooms.",
    "Fresh web research. Another unit's offer remains a reference, not a confirmed cost.",
    "不足する月額をネットで再調査します。別室の募集は参考情報として扱います。",
  );
  const gran = page.locator("#compareHead th[data-property]").last();
  await gran.locator("summary").click();
  await gran.locator("[data-research]").click();
  await live("/api/research-listing", () => click("#researchRun"));
  await page.waitForFunction(
    () => !document.querySelector("#researchRun").disabled,
  );
  await hold(6000);
  await click("#researchClose");

  await chapter(
    "Ask AI and confirm",
    "Let actual candidate differences guide the conversation.",
    "Live Gemini replies. A suggested priority is saved only after explicit confirmation.",
    "実際のGemini応答で希望を整理します。提案は本人が確認してから保存します。",
  );
  await click("#guide-ai");
  await live("/api/advise", () => click("#advisorStart"));
  for (
    let i = 0;
    i < 3 && !(await page.locator("[data-confirm-proposal]").count());
    i++
  ) {
    await page.locator("[data-advisor-answer]").first().waitFor();
    await page.locator("#advisorQuestion").scrollIntoViewIfNeeded();
    await hold(6000);
    await live("/api/advise", () => click("[data-advisor-answer]"));
  }
  await page.locator("[data-confirm-proposal]").first().waitFor();
  await page.locator(".advisor-proposal").first().scrollIntoViewIfNeeded();
  await hold(5000);
  await click("[data-confirm-proposal]");
  await hold();

  await chapter(
    "Check the commute",
    "Choose a destination, then continue in Google Maps.",
    "Prefilled outbound / return routes. Set 08:00 arrival and 18:00 departure in Maps.",
    "目的地を選び、入力済みのMapsリンクへ。朝8時到着・夕18時出発はMaps側で設定します。",
  );
  await click("#tab-commute");
  await hold();
  await page.locator("#destinationPreset").selectOption("shinjuku");
  await page.locator("#commuteResults").scrollIntoViewIfNeeded();
  const routes = await page
    .locator("[data-commute-link]")
    .evaluateAll((nodes) => nodes.map((n) => n.href));
  if (
    routes.length !== 6 ||
    routes.some((url) => !url.includes("google.com/maps"))
  )
    throw Error("Missing Maps routes");
  await hold(5000);

  await chapter(
    "Verify walking claims",
    "Check the station and shopping against Maps.",
    "Live places and walking estimates are dated observations, not guarantees.",
    "駅・買い物への徒歩情報をGoogle Mapsで照合します。取得日時付きの目安です。",
  );
  await click("#tab-surroundings");
  await live("/api/check-maps", () => click("[data-check-maps]"));
  await page.locator("#mapsResults").scrollIntoViewIfNeeded();
  await hold(6000);
  await click("#mapsClose");

  await chapter(
    "Discover leisure",
    "See nearby places before choosing what matters.",
    "Real parks, gyms and cafés. Confirm an interest and frequency from the results.",
    "公園・ジム・カフェを検索し、結果を見て関心と頻度を確認します。",
  );
  await click("#tab-leisure");
  await live("/api/leisure", () => click("#discoverLeisure"));
  await page.locator("#leisureResults").scrollIntoViewIfNeeded();
  await hold(6000);
  await click('[data-interest="park"]');
  await hold();
  await click("#leisurePreferenceForm button");
  await hold();

  await chapter(
    "Search apartment reviews",
    "Search the apartment, building, then nearby references.",
    "Live web search. No usable review means an empty result, not invented feedback.",
    "部屋・建物・近隣の順で口コミを検索します。見つからなければ空欄のままです。",
  );
  await live("/api/reviews/web", () => click("#tab-reviews"));
  await page.locator("#reviewResults").scrollIntoViewIfNeeded();
  await hold(6500);

  await chapter(
    "Compare weekly scenarios",
    "Try a weekly routine with the information available.",
    "Confirm two commuting days. Unknown transit times stay unknown.",
    "週2日の通勤を想定して確認します。未取得の所要時間は補いません。",
  );
  await click("#tab-scenarios");
  await page.locator("#scenarioDays").selectOption("2");
  await hold();
  await click("#scenarioForm button");
  await hold(5000);

  await chapter(
    "Read the decision brief",
    "Turn confirmed priorities into a useful brief.",
    "Your choices and open questions are assembled automatically.",
    "確認した希望と未解決の質問をメモに自動でまとめます。",
  );
  await click("#tab-needs");
  await hold(6000);
  await page.locator("#memo").evaluate((el) => (el.scrollTop = 240));
  await hold();

  await chapter(
    "Export and share",
    "Preview, download, and create an expiring share.",
    "Real HTML export and server-backed sharing. Only selected content leaves this browser.",
    "内容を確認してHTML保存し、実際のAPIで期限付きリンクを作成します。",
  );
  await click("#tab-sharing");
  await hold();
  const download = page.waitForEvent("download");
  await click("#exportBrief");
  await (await download).saveAs("output/playwright/demo-brief.html");
  await live("/api/shares", () => click("#createShare"));
  await hold(5000);
  const shareUrl = await page
    .locator("#shareLinks a")
    .first()
    .getAttribute("href");
  const ownerUrl = page.url();
  const overlay = await page
    .locator("#film-caption")
    .evaluate((el) => el.outerHTML);
  const style = await page.locator("style").last().textContent();
  async function navigate(url) {
    await page.goto(url);
    await page.addStyleTag({ content: style });
    await page.evaluate(
      (html) => document.body.insertAdjacentHTML("beforeend", html),
      overlay,
    );
  }
  try {
    await pace();
    await navigate(shareUrl);
    await page.locator("#sharedBrief h2").waitFor({ timeout: 30000 });
    await hold(6000);
    await navigate(ownerUrl);
    await page.locator("[data-revoke-share]").first().waitFor();
    await live("/api/shares/revoke", () => click("[data-revoke-share]"));
    await hold();
    await pace();
    const revoked = page.waitForResponse((r) =>
      r.url().endsWith("/api/shares/read"),
    );
    await navigate(shareUrl);
    if ((await revoked).status() !== 404)
      throw Error("Revoked share is still readable");
    await page.waitForFunction(() =>
      document.querySelector("#sharedStatus").textContent.includes("削除済み"),
    );
    await hold(5000);
  } finally {
    await navigate(ownerUrl);
    if (await page.locator("[data-revoke-share]").count()) {
      await live("/api/shares/revoke", () => click("[data-revoke-share]"));
    }
  }
  await chapter(
    "Run your own instance",
    "Watch the recording. Deploy the complete app.",
    "Local live API recording. Deployment instructions are linked in the README.",
    "ローカル環境の実接続による録画です。完全なアプリのデプロイ手順はREADMEから参照できます。",
  );
  await click("#tab-compare");
  await page.evaluate(() => window.scrollTo(0, 0));
  await hold(5000);
  return {
    chapters,
    duration: (Date.now() - started) / 1000,
    environment: "local-live-api",
    recordedAt: new Date().toISOString(),
  };
};
