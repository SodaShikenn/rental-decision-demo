import { $, escapeHTML as e } from '../../helper.js';
import { EXTRACTION_API_URL } from '../../config.js';
import { LEVELS, formatPriority } from '../priorities/services.js';
import { advisorEvidence, advisorInput, confirmProposal, requestAdvice } from './services.js';

import { visibleCandidates } from "../workspace/services.js";

export function initApp(app) {
  const { store } = app.extensions;
  let busy = false, controller, sequence = 0, retryHistory = store.state.advisor.pendingHistory ?? null;
  const evidence = () => advisorEvidence(visibleCandidates(store.state.properties, store.state.workspace), app.extensions.mapsObservations?.() ?? []);
  const fingerprintOf = () => JSON.stringify({ focus: store.state.workspace.dimension, evidence: evidence() });
  if (store.state.advisor.fingerprint !== fingerprintOf()) {
    retryHistory = null;
    if (store.state.advisor.pendingHistory) store.setAdvisor({ ...store.state.advisor, pendingHistory: null });
  }
  const source = (ids) => {
    const data = evidence();
    return `<details class="advisor-sources"><summary>判断の材料を見る</summary>${ids.map((id) => data.find((v) => v.id === id)).filter(Boolean).map((item) => `<p><strong>${e(item.candidate)}</strong> · ${item.kind === 'maps' ? '<span translate="no">Google Maps</span>' : item.kind === 'unknown' ? '未確認' : '掲載情報'}<br>${e(item.text)}</p>`).join('')}</details>`;
  };
  function render() {
    const session = store.state.advisor;
    const currentEvidence = evidence();
    const fresh = session?.fingerprint === fingerprintOf();
    const reply = fresh ? session.reply : null;
    $('#advisorStart').hidden = !!reply;
    $('#advisorStart').disabled = busy || !currentEvidence.length;
    $('#advisorStart').textContent = session.history?.length ? '今の候補で相談を再開' : 'この比較から相談する';
    $('#advisorBody').innerHTML = reply ? `<p class="eyebrow">AI の分析 · 解釈は確認してください</p>${reply.insights.map((i) => `<div class="advisor-insight"><p>${e(i.text)}</p>${source(i.evidenceIds)}</div>`).join('')}
      ${reply.proposals.map((p, index) => `<div class="advisor-proposal"><h4>回答から見えてきた希望（まだ未確定）</h4><p>${e(p.text)}</p><p>重要度：${e(LEVELS[p.level])}${p.key !== 'note' ? ` · ${e(formatPriority(p.key, p.value))}${p.key === 'area' ? '以上' : '以下'}` : ''}</p><p class="section-hint">あなたの回答：「${e(p.userQuote)}」</p><button class="button" data-confirm-proposal="${index}" ${busy ? 'disabled' : ''}>この理解で希望に加える</button><button class="button button--text" data-dismiss-proposal="${index}" ${busy ? 'disabled' : ''}>今回は加えない</button></div>`).join('')}
      <h3 id="advisorQuestion" tabindex="-1">${e(reply.question)}</h3>${source(reply.evidenceIds)}<div class="discovery-options">${[...reply.options, 'まだ決められない・条件による'].map((option) => `<button class="button" data-advisor-answer="${e(option)}" ${busy ? 'disabled' : ''}>${e(option)}</button>`).join('')}</div>` : '<p>候補の費用・広さ・設備・契約と、確認済みの地図情報から考えます。最初に希望を書く必要はありません。</p>';
    $('#advisorReplyForm').hidden = !reply;
    $('#advisorReplyForm button').disabled = busy;
    $('#advisorHistory').innerHTML = (session.history ?? []).map((turn) => `<p><strong>${turn.role === 'user' ? 'あなた' : 'AI'}：</strong>${e(turn.text)}</p>`).join('') || '<p>相談を始めると、ここに会話が残ります。</p>';
    $('#advisorNotes').innerHTML = (store.state.priorities.notes ?? []).map((note, i) => `<li>${e(LEVELS[note.level])}：${e(note.text)} <button class="link-button" data-remove-note="${i}">取り消す</button></li>`).join('');
    $('#advisorRetry').hidden = !retryHistory;
    $('#advisorRetry').disabled = busy;
  }
  async function run(answer = null, retry = false) {
    if (busy) return;
    const items = evidence(), fingerprint = fingerprintOf();
    const session = store.state.advisor;
    const fresh = session.fingerprint === fingerprint;
    const history = retry ? retryHistory : fresh ? [...session.history] : [];
    if (!history) return;
    if (answer) {
      if (session.reply && fresh) history.push({ role: 'assistant', text: session.reply.question });
      history.push({ role: 'user', text: answer });
    }
    const input = advisorInput(store.state, items, history);
    const requestState = JSON.stringify(input.confirmed);
    const id = ++sequence;
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 80000);
    busy = true; retryHistory = null;
    store.setAdvisor({ ...session, fingerprint, history: fresh ? session.history : [], reply: fresh ? session.reply : null, pendingHistory: history.slice(-22), usesMaps: items.some((i) => i.kind === 'maps') });
    $('#advisorStatus').textContent = '候補と回答をもとに考えています…'; render();
    try {
      const reply = await requestAdvice(EXTRACTION_API_URL ? `${EXTRACTION_API_URL}/api/advise` : '', input, { signal: controller.signal });
      if (id !== sequence) return;
      if (fingerprint !== fingerprintOf() || requestState !== JSON.stringify(advisorInput(store.state, evidence(), []).confirmed)) {
        $('#advisorStatus').textContent = '候補や希望が変わりました。今の情報で相談を再開してください。'; return;
      }
      store.setAdvisor({ history: history.slice(-22), reply, fingerprint, usesMaps: items.some((i) => i.kind === 'maps') });
      $('#advisorReply').value = '';
      $('#advisorStatus').textContent = 'AIの解釈です。提案した希望は、確認してからメモに反映します。';
    } catch (error) {
      if (id === sequence) { retryHistory = history; $('#advisorStatus').textContent = error.name === 'AbortError' ? '相談がタイムアウトしました。再試行できます。' : error.message; }
    } finally {
      clearTimeout(timer);
      if (id === sequence) { busy = false; render(); $('#advisorQuestion')?.focus({ preventScroll: true }); }
    }
  }
  $('#advisorStart').addEventListener('click', () => run());
  $('#advisorRetry').addEventListener('click', () => run(null, true));
  $('#advisorBody').addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || busy) return;
    if (button.dataset.advisorAnswer) { run(button.dataset.advisorAnswer); return; }
    const confirm = button.dataset.confirmProposal;
    const index = Number(confirm ?? button.dataset.dismissProposal);
    const session = store.state.advisor;
    if (!Number.isInteger(index) || !session.reply?.proposals[index] || session.fingerprint !== fingerprintOf()) return;
    const proposal = session.reply.proposals[index];
    const history = [...session.history, { role: 'user', text: `${confirm != null ? '確認しました。希望に加えます' : 'この提案は希望に加えません'}：${proposal.text}` }].slice(-22);
    store.setAdvisor({ ...session, history, reply: { ...session.reply, proposals: session.reply.proposals.filter((_, i) => i !== index) } });
    if (confirm != null) store.setPriorities(confirmProposal(store.state.priorities, proposal));
    $('#advisorStatus').textContent = confirm != null ? '希望を確認しました。数値条件は候補との比較に、それ以外の希望はメモに反映しました。' : '希望には加えませんでした。';
    render();
  });
  $('#advisorReplyForm').addEventListener('submit', (event) => { event.preventDefault(); const value = $('#advisorReply').value.trim(); if (value) run(value); });
  $('#advisorNotes').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-note]'); if (!button) return;
    store.setPriorities({ ...store.state.priorities, notes: store.state.priorities.notes.filter((_, i) => i !== Number(button.dataset.removeNote)) });
  });
  const changed = () => {
    if (store.state.advisor.fingerprint !== fingerprintOf()) {
      if (busy) { ++sequence; controller?.abort(); busy = false; }
      retryHistory = null;
      if (store.state.advisor.pendingHistory) store.setAdvisor({ ...store.state.advisor, pendingHistory: null });
      $('#advisorStatus').textContent = '';
    }
    render();
  };
  store.on('change', changed); store.on('workspace', changed); store.on('maps-updated', changed); store.on('advisor', render);
  render();
}
