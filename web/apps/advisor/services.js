import { observedValue, formatPriority } from '../priorities/services.js';
import { equipmentOnSheet } from '../compare/services.js';
import { visibleCandidates } from '../workspace/services.js';
import { buildTenantMemo } from '../needs/services.js';
import { monthlyReferences } from '../research/monthly.js';

export function advisorEvidence(properties, maps = []) {
  const evidence = [];
  properties.forEach((p, index) => {
    const add = (suffix, kind, text) => evidence.push({ id: `c${index}-${suffix}`, candidate: p.name.slice(0, 200), kind, text: text.slice(0, 1500) });
    for (const [key, label] of [['budget', '月額（賃料＋管理費のみ）'], ['walk', '掲載の駅徒歩'], ['area', '掲載面積']]) {
      const value = observedValue(p, key);
      add(key, value == null ? 'unknown' : 'listing', `${label}：${value == null ? '未取得／未確認（推測不可）' : formatPriority(key, value)}${key === 'walk' && value != null ? `。掲載駅：${p.station}` : ''}`);
    }
    if (p.provenance?.mode !== 'mock') {
      monthlyReferences(p).slice(0, 3).forEach((reference, n) => add(`reference-rent${n}`, 'listing', `同じ建物の参考募集：${reference.room || '部屋番号不明'}号室、${reference.layout || '間取り不明'}、${reference.areaSqm ?? '面積不明'}㎡。賃料＋管理費 ${reference.monthly}円。候補との部屋の一致は未確認。候補の確定月額・予算判定には使用不可。掲載日 ${reference.source.listingDate || '不明'}、取得 ${reference.source.retrievedAt}。出典 ${reference.source.url}`));
      add('equipment', 'listing', `図面に記載の設備（現地未確認）：${equipmentOnSheet(p).map((v) => v.label).join('、') || '未取得'}`);
      add('contract', 'listing', `掲載の契約・内見事項：${(p.checks ?? []).map((c) => `${c.title}：${c.sourceText ?? ''}`).join('／') || '未取得'}`);
    }
    const observation = maps.find((m) => m.id === p.id && m.status === 'checked');
    if (observation) {
      add('maps', 'maps', `Google Maps 取得日時 ${observation.checkedAt}。出発住所 ${observation.origin.address}。施設の入口は未確認。`);
      observation.claims.slice(0, 4).forEach((c, n) => add(`mapclaim${n}`, 'maps', `${c.claim.name}：照合状態 ${c.status}。掲載 ${c.claim.minutes ?? '不明'}分。Google Maps 徒歩 ${c.route?.minutes ?? '未取得'}分、${c.route?.meters ?? '未取得'}m。営業状態 ${c.place?.businessStatus ?? '不明'}。取得 ${observation.checkedAt}`));
      observation.nearby.forEach((group) => add(`near-${group.kind}`, 'maps', `${group.kind} 検索（1.5km内・直線距離順最大3件、最寄り保証なし）：${group.places.map((p) => `${p.name} 徒歩${p.route?.minutes ?? '不明'}分 ${p.route?.meters ?? '不明'}m 営業状態${p.businessStatus}`).join('／') || '取得なし（存在しないとは限らない）'}。取得 ${observation.checkedAt}`));
    }
  });
  return evidence.slice(0, 80);
}
export const evidenceFingerprint = (evidence) => JSON.stringify(evidence);
export function advisorInput(state, evidence, history) {
  return { focus: state.workspace?.dimension ?? 'all', evidence, confirmed: buildTenantMemo({ ...state, properties: visibleCandidates(state.properties, state.workspace) }).text.slice(0, 6000), history: history.slice(-24) };
}
export function confirmProposal(priorities, proposal) {
  const next = { ...priorities };
  if (['budget', 'walk', 'area'].includes(proposal.key) && Number.isFinite(proposal.value) && proposal.value > 0) {
    next[proposal.key] = { value: proposal.value, level: proposal.level };
    next.pending = (next.pending ?? []).filter((k) => k !== proposal.key);
  } else if (proposal.key === 'note') {
    next.notes = [...(next.notes ?? []).filter((n) => n.text !== proposal.text), { text: proposal.text, level: proposal.level }].slice(-20);
  }
  return next;
}
export async function requestAdvice(endpoint, input, { signal, fetchImpl = fetch } = {}) {
  if (!endpoint) throw new Error('AI相談サーバーが未設定です。数値の質問は引き続き使えます。');
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || 'AI相談に接続できませんでした。');
  if (!body?.question || !Array.isArray(body.insights) || !Array.isArray(body.options) || !Array.isArray(body.proposals)) throw new Error('AIの回答を確認できませんでした。');
  return body;
}
