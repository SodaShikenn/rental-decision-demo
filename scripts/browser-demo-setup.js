// Recording decoration only. All requests reach the real application/API.
async (page) => {
  page.setDefaultTimeout(30000);
  const health = await page.request.get("http://127.0.0.1:8000/healthz");
  const status = await health.json();
  if (
    !health.ok() ||
    status.mode !== "live" ||
    !status.configured ||
    !status.enabled ||
    !status.research?.enabled ||
    !status.research?.configured ||
    !status.maps?.configured ||
    !status.sharing?.enabled
  )
    throw Error("A configured live API is required to record this film");
  await page.locator("#compareRows .cell").first().waitFor();
  await page.addStyleTag({
    content: `
    html { scroll-padding-bottom: 150px; }
    body { padding-bottom: 150px; }
    dialog { max-height: calc(100dvh - 180px) !important; margin-top: 24px; }
    #film-caption { position:fixed; inset:auto 0 0; z-index:2147483647; pointer-events:none;
      background:#183e32; color:#fff; padding:18px 32px; font-family:Arial,sans-serif; }
    #film-caption small { display:block; font-size:12px; letter-spacing:1.4px; color:#bfdbce; margin-bottom:8px; }
    #film-caption strong { font-size:26px; font-weight:500; line-height:1.25; display:block; }
    #film-caption p { margin:7px 0 0; font-size:16px; color:#e2ece6; }
  `,
  });
  await page.evaluate(() => {
    const caption = document.createElement("aside");
    caption.id = "film-caption";
    caption.innerHTML = `<small>LOCAL APP · LIVE APIs · ${new Date().toISOString().slice(0, 10)}</small><strong>Start with homes. Discover what matters.</strong><p>Recorded listing inputs · real Gemini and Google Maps requests</p>`;
    document.body.append(caption);
  });
};
