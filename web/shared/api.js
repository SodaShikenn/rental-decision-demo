import { EXTRACTION_API_URL } from "../config.js";
/** A small, injectable HTTP boundary. Feature controllers own cancellation and stale guards. */
export async function post(path, body, { signal, fetchImpl = fetch } = {}) {
  if (!EXTRACTION_API_URL)
    throw new Error("サーバーが未設定です。ローカルの比較とメモは使えます。");
  const response = await fetchImpl(`${EXTRACTION_API_URL}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error?.message ||
        "取得できませんでした。時間をおいて再試行してください。",
    );
  if (!data) throw new Error("応答を読み取れませんでした。");
  return data;
}
