import { stationMentions, stationName } from '../compare/services.js';

export function mapsInput(property) {
  const claims = stationMentions([property.station ?? '', ...(property.sheet?.lines ?? [])].filter((line) => /駅|線/.test(typeof line === 'string' ? line : line.text ?? '')))
    .map((item) => ({ name: `${item.station}駅`, kind: 'station', minutes: item.minutes }));
  if (!claims.length && stationName(property.station)) claims.push({ name: `${stationName(property.station)}駅`, kind: 'station' });
  // Only explicitly named, quantified amenities. Generic “スーパー徒歩5分” has no identity to match.
  for (const line of property.sheet?.lines ?? []) {
    const text = (typeof line === 'string' ? line : line.text ?? '').normalize('NFKC');
    const match = text.match(/(?:スーパー|コンビニ)[「『]([^」』]+)[」』]\s*(?:まで)?\s*(?:徒歩\s*(\d+)\s*分|(\d+)\s*m)/i);
    if (match) claims.push({ name: match[1], kind: text.includes('スーパー') ? 'supermarket' : 'convenience_store', ...(match[2] ? { minutes: Number(match[2]) } : { meters: Number(match[3]) }) });
  }
  return { address: property.address ?? '', claims: [...new Map(claims.map((claim) => [JSON.stringify(claim), claim])).values()].slice(0, 8) };
}
export const mapsFingerprint = (property) => JSON.stringify(mapsInput(property));
export async function requestMaps(endpoint, input, { signal, fetchImpl = fetch } = {}) {
  if (!endpoint) throw new Error('地図の確認サーバーが未設定です。');
  if (!input.address.trim()) throw new Error('先に候補の住所を取得・確認してください。');
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || '地図の確認に失敗しました。');
  if (!Array.isArray(body?.claims) || !Array.isArray(body?.nearby)) throw new Error('地図の応答を確認できませんでした。');
  return body;
}
