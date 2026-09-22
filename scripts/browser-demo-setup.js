// Recording-only fixtures. Never loaded by the deployed application.
async (page) => {
  await page.route("**/api/**", (route) => {
    if (!route.request().url().endsWith("/api/advise"))
      return route.fulfill({
        status: 503,
        json: { error: { message: "Recording: provider calls disabled" } },
      });
    const input = route.request().postDataJSON();
    const ids = input.evidence
      .filter((item) => item.id.endsWith("-budget"))
      .map((item) => item.id);
    const answered = input.history.some((turn) => turn.role === "user");
    return route.fulfill({
      json: {
        insights: [
          {
            text: "月額は11万円と13万円。GRAN PASEOは別室の参考価格なので、予算の判定には使いません。",
            evidenceIds: ids,
          },
        ],
        question: answered
          ? "次は広さと駅への距離、どちらを見比べたいですか？"
          : "この違いなら、月額とほかの魅力をどう考えたいですか？",
        options: answered
          ? ["広さを見比べたい", "駅への距離を見たい"]
          : [
              "11万円を目安に、ほかの魅力次第で考えたい",
              "13万円まで含めて比べたい",
            ],
        evidenceIds: ids,
        proposals: answered
          ? [
              {
                key: "budget",
                value: 110000,
                level: "prefer",
                text: "月額11万円を目安に、ほかの魅力次第で柔軟に考える。",
                userQuote: "11万円を目安に、ほかの魅力次第で考えたい",
                evidenceIds: ids,
              },
            ]
          : [],
      },
    });
  });
  await page.route("**/healthz", (route) =>
    route.fulfill({ json: { enabled: false, configured: false } }),
  );
  await page.reload();
  await page.locator("#compareRows .cell").first().waitFor();
  await page.addStyleTag({
    content: `
    html { scroll-padding-bottom: 160px; }
    body { padding-bottom: 160px; }
    #film-caption { position:fixed; inset:auto 0 0; z-index:2147483647; pointer-events:none;
      background:#183e32; color:#fff; padding:23px 36px; font-family:Arial,sans-serif; }
    #film-caption small { display:block; font-size:13px; letter-spacing:1.4px; color:#bfdbce; margin-bottom:9px; }
    #film-caption strong { font-size:27px; font-weight:500; line-height:1.25; display:block; }
    #film-caption p { margin:7px 0 0; font-size:17px; color:#e2ece6; }
    #film-label { position:fixed; right:24px; top:18px; z-index:2147483647; background:#183e32;
      color:#fff; padding:9px 14px; border-radius:5px; font:12px Arial,sans-serif; pointer-events:none; }
  `,
  });
  await page.evaluate(() => {
    const caption = document.createElement("aside");
    caption.id = "film-caption";
    caption.innerHTML =
      "<small>RENTAL HELPER / PRODUCT WALKTHROUGH</small><strong>Start with homes. Discover what matters.</strong><p>Real interface · recorded listings · scripted AI responses for this demonstration</p>";
    const label = document.createElement("div");
    label.id = "film-label";
    label.textContent = "SIMULATED DEMO · AI replies scripted";
    document.body.append(caption, label);
  });
};
