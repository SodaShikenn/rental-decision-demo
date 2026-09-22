import { $, escapeHTML as e } from '../../helper.js';
import { EXTRACTION_API_URL } from '../../config.js';
import { safeSourceUrl } from '../research/services.js';
import { mapsFingerprint, mapsInput, requestMaps } from './services.js';

const kinds = { station: '駅', supermarket: 'スーパー', convenience_store: 'コンビニ' };
const statuses = { difference: '掲載値との差を確認', close: '掲載値に近い目安', reference: '参考情報', unverified: '未確認' };
const business = { OPERATIONAL: '営業中の施設として登録', CLOSED_TEMPORARILY: '一時休業として登録', CLOSED_PERMANENTLY: '閉業として登録', UNKNOWN: '営業状況は未確認' };
const link = (url, label) => safeSourceUrl(url) ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>` : e(label);
function routeMarkup(route) {
  return route ? `<p>徒歩 約<strong>${e(route.minutes)}分</strong> · ${e(route.meters)}m　${link(route.url, '経路を見る')}</p>${(route.warnings ?? []).map((warning) => `<p class="section-hint">${e(warning)}</p>`).join('')}` : '<p>徒歩経路は取得できませんでした。</p>';
}
function placeMarkup(place) {
  if (!place) return '';
  return `<p>${link(place.url, place.name)} · ${e(business[place.businessStatus] ?? business.UNKNOWN)}</p><p class="section-hint">${e(place.address)}</p>${(place.attributions ?? []).map((a) => link(a.providerUri, a.provider)).join(' ')}`;
}
function resultMarkup(result) {
  if (result.status !== 'checked') return `<p>${e(result.message)}</p>`;
  return `<div class="maps-provider"><p class="maps-attribution" translate="no">Google Maps</p>
    <p>確認日時：${e(new Date(result.checkedAt).toLocaleString('ja-JP'))}</p>
    <p>出発地点：${link(result.origin.url, result.origin.address)}${result.origin.precision === 'RANGE_INTERPOLATED' ? '（住所から推定した位置）' : ''}</p>
    <p class="section-hint">建物・入口が合っているか経路で確認してください。Google Maps の取得時点の情報であり、現地の状況を保証しません。</p>
    <h3>掲載されている徒歩時間・距離と照合</h3>
    ${result.claims.length ? result.claims.map((item) => `<article class="maps-item"><h4>${e(item.claim.name)} · ${statuses[item.status] ?? '未確認'}</h4>
      <p>掲載：${item.claim.minutes != null ? `徒歩${e(item.claim.minutes)}分` : ''}${item.claim.meters != null ? ` ${e(item.claim.meters)}m` : ''}</p>
      ${placeMarkup(item.place)}${item.place ? routeMarkup(item.route) : `<p>${e(item.reason ?? '施設を特定できませんでした。')}</p>`}
      ${item.differenceMinutes != null ? `<p>掲載との差：${item.differenceMinutes > 0 ? '+' : ''}${e(item.differenceMinutes)}分</p>` : ''}
      ${item.differenceMeters != null ? `<p>掲載との差：${item.differenceMeters > 0 ? '+' : ''}${e(item.differenceMeters)}m</p>` : ''}</article>`).join('') : '<p>照合できる施設名・徒歩時間を読み取れていません。</p>'}
    <h3>近くの買い物・駅へのアクセス</h3><p class="section-hint">半径1.5km内をカテゴリ別に検索し、直線距離順で最大3件の徒歩経路を調べます。最短の徒歩経路や施設の網羅性は保証しません。施設名を読み取れない掲載内容は照合していません。</p>
    ${result.nearby.map((group) => `<h4>${kinds[group.kind]}</h4>${group.error ? `<p>${e(group.error)}</p>` : !group.places.length ? '<p>検索結果なし（施設がないという意味ではありません）</p>' : group.places.map((place) => `<article class="maps-item">${placeMarkup(place)}${routeMarkup(place.route)}</article>`).join('')}`).join('')}
    <p class="section-hint">徒歩時間は目安です。信号・駅の出口・入口・歩く速さで変わります。3分以上または100m以上の差を確認対象として表示します。差だけで掲載内容の誤りとは判断しません。営業状況は現在の営業時間内かどうかを示すものではありません。</p></div>`;
}

export function initApp(app) {
  const { store } = app.extensions;
  const results = new Map();
  app.extensions.mapsObservations = () => [...results.entries()].filter(([id, entry]) => {
    const p = store.state.properties.find((p) => p.id === id);
    return p && entry.fingerprint === mapsFingerprint(p);
  }).map(([id, entry]) => ({ id, ...entry.result }));
  const dialog = $('#mapsDialog');
  let active = null, controller = null, generation = 0;
  function render() {
    for (const [id, entry] of results) {
      const p = store.state.properties.find((p) => p.id === id);
      if (!p || entry.fingerprint !== mapsFingerprint(p)) results.delete(id);
    }
    $('#mapsCandidates').innerHTML = store.state.properties.map((p) => {
      const entry = results.get(p.id);
      const summary = entry?.result.status === 'checked' ? `${entry.result.claims.filter((c) => c.status === 'difference').length}件の差・${entry.result.claims.filter((c) => c.status === 'unverified').length}件未確認（${new Date(entry.result.checkedAt).toLocaleTimeString('ja-JP')}取得）` : '地図は未確認';
      return `<article class="maps-card"><h3>${e(p.name)}</h3><p>${e(summary)}</p><button class="button" data-check-maps="${e(p.id)}">${entry ? '確認結果を見る' : '駅・買い物を地図で確認'}</button></article>`;
    }).join('') || '<p>候補を追加すると、駅や買い物へのアクセスを確認できます。</p>';
    if (active && !store.state.properties.some((p) => p.id === active)) dialog.close();
  }
  async function run() {
    const property = store.state.properties.find((p) => p.id === active);
    if (!property) return;
    const id = ++generation, fingerprint = mapsFingerprint(property), propertyId = property.id;
    controller?.abort(); controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    $('#mapsRefresh').disabled = true;
    $('#mapsStatus').textContent = '住所・施設・徒歩経路を確認しています…';
    $('#mapsResults').innerHTML = '';
    results.delete(propertyId); render();
    store.emit("maps-updated");
    try {
      const result = await requestMaps(EXTRACTION_API_URL ? `${EXTRACTION_API_URL}/api/check-maps` : '', mapsInput(property), { signal: controller.signal });
      if (generation !== id) return;
      const current = store.state.properties.find((p) => p.id === propertyId);
      if (!current || mapsFingerprint(current) !== fingerprint) { $('#mapsStatus').textContent = '候補の情報が変わりました。再確認してください。'; return; }
      results.set(propertyId, { fingerprint, result });
      $('#mapsStatus').textContent = '掲載値を残したまま、地図の情報と比較しています。';
      $('#mapsResults').innerHTML = resultMarkup(result);
      render();
      store.emit("maps-updated");
    } catch (error) {
      if (generation === id) $('#mapsStatus').textContent = error.name === 'AbortError' ? '確認がタイムアウトしました。もう一度お試しください。' : error.message;
    } finally { clearTimeout(timer); if (generation === id) $('#mapsRefresh').disabled = false; }
  }
  $('#mapsCandidates').addEventListener('click', (event) => {
    const button = event.target.closest('[data-check-maps]');
    if (!button) return;
    active = button.dataset.checkMaps;
    const property = store.state.properties.find((p) => p.id === active);
    $('#mapsTitle').textContent = `${property.name} · 駅と買い物`;
    $('#mapsRefresh').disabled = false;
    $('#mapsStatus').textContent = '';
    $('#mapsResults').innerHTML = '';
    dialog.showModal();
    const entry = results.get(active);
    if (entry) $('#mapsResults').innerHTML = resultMarkup(entry.result);
    else run();
  });
  $('#mapsClose').addEventListener('click', () => dialog.close());
  $('#mapsRefresh').addEventListener('click', run);
  dialog.addEventListener('close', () => { generation++; controller?.abort(); active = null; });
  store.on('change', render);
  store.on('workspace', render);
  render();
}
