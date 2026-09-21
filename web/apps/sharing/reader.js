import { post } from "../../shared/api.js";
import { briefMarkup } from "./views.js";
const status = document.querySelector("#sharedStatus"),
  content = document.querySelector("#sharedBrief");
const token = location.hash.slice(1);
if (!/^[A-Za-z0-9_-]{43}$/.test(token))
  status.textContent = "共有リンクを確認してください。";
else {
  try {
    const data = await post(
      "shares/read",
      { token },
      { signal: AbortSignal.timeout(20000) },
    );
    content.innerHTML = briefMarkup(data.brief);
    status.textContent = `${new Date(data.expiresAt * 1000).toLocaleString("ja-JP")}まで閲覧できます。`;
  } catch (error) {
    status.textContent = error.message || "共有メモを取得できませんでした。";
  }
}
