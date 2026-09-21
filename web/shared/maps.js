import { escapeHTML as e } from '../helper.js';
export function safeLink(url) { try { const u=new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
export function sourceLink(url,label='Google Maps で見る') { const safe=safeLink(url); return safe ? `<a href="${e(safe)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>` : ''; }
export function attribution(items=[]) { return items.map(a=>sourceLink(a.providerUri,a.provider||'情報提供')).join(' · '); }
export const mapsCredit = '<span class="maps-credit" translate="no">Google Maps</span>';
export const candidateInputs = state => state.properties.map(({id,name,address})=>({id,name,address:address||''}));
export const candidateFingerprint = state => JSON.stringify(candidateInputs(state));
export function formatTime(value) { if(!value) return '未取得'; const d=new Date(value); return Number.isFinite(+d) ? new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d) : '未取得'; }
export function saveNote(store, text, level, source, details = {}) {
  store.setPriorities({...store.state.priorities, notes:[...(store.state.priorities.notes||[]).filter(n=>n.source!==source),{text,level,source,details}].slice(-20)});
}
