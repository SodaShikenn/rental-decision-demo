import test from 'node:test';
import assert from 'node:assert/strict';
import { mapsInput, mapsFingerprint, requestMaps } from '../../../apps/maps/services.js';

test('maps check retains multiple station claims and deduplicates exact repeats', () => {
  const p = { address: '東京都世田谷区', station: '小田急線「下北沢」駅 徒歩2分', sheet: { lines: ['小田急線「下北沢」駅 徒歩2分', '京王線「笹塚」駅 徒歩11分'] } };
  assert.deepEqual(mapsInput(p).claims.map((c) => c.minutes), [2, 11]);
  assert.notEqual(mapsFingerprint(p), mapsFingerprint({ ...p, address: '東京都渋谷区' }));
});
test('named amenity claim is extracted, anonymous claim is not guessed', () => {
  const input = mapsInput({ sheet: { lines: ['スーパー「テスト店」徒歩5分', 'スーパー徒歩3分'] } });
  assert.deepEqual(input.claims, [{ name: 'テスト店', kind: 'supermarket', minutes: 5 }]);
});
test('missing endpoint and provider errors never become successful checks', async () => {
  await assert.rejects(requestMaps('', { address: '東京都' }), /未設定/);
  await assert.rejects(requestMaps('/api/check-maps', { address: '東京都' }, { fetchImpl: async () => ({ ok: false, json: async () => ({ error: { message: '失敗' } }) }) }), /失敗/);
});
