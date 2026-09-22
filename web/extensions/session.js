const DB_NAME = 'rental-helper-session';
const KEYS = ['properties', 'settings', 'priorities', 'rentOverrides', 'pickOverrides', 'answers', 'sheetsVersion', 'advisor'];
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Session storage blocked'));
  });
}
async function transaction(mode, run) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('session', mode);
      const request = run(tx.objectStore('session'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export function validSnapshot(value) {
  const s = value?.state;
  return value?.version === 1 && Array.isArray(s?.properties) && s.properties.length <= 6 &&
    s.properties.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string') &&
    s.settings && typeof s.settings.moveIn === 'string' && s.priorities &&
    ['budget', 'walk', 'area'].every((key) => ['later', 'prefer', 'must'].includes(s.priorities[key]?.level)) &&
    typeof s.priorities.lifestyle === 'string' && typeof s.priorities.openQuestions === 'string' &&
    ['answers', 'pickOverrides', 'rentOverrides'].every((key) => s[key] && typeof s[key] === 'object');
}
export async function restoreSession() {
  const snapshot = await transaction('readonly', (s) => s.get('current'));
  if (!snapshot) return null;
  if (!validSnapshot(snapshot)) throw new Error('Saved session is incompatible');
  for (const property of snapshot.state.properties) {
    const blob = snapshot.images?.[property.id];
    if (blob instanceof Blob && property.sheet) property.sheet.image = URL.createObjectURL(blob);
  }
  return restoredState(snapshot.state);
}
// Old handwritten notes/memo overrides never re-enter the generated analysis.
export function restoredState(state) {
  return Object.fromEntries(KEYS.filter((key) => key in state).map((key) => [key, state[key]]));
}
export function sessionSnapshot(state) {
  const copy = structuredClone(Object.fromEntries(KEYS.map((key) => [key, state[key]])));
  // Maps observations and conversations that reproduce them are ephemeral.
  if (copy.advisor?.usesMaps) copy.advisor = { history: [], reply: null, fingerprint: '', usesMaps: false };
  return { version: 1, state: copy, images: {} };
}
export function attachSession(store, initialError = false) {
  const status = document.querySelector('#sessionStatus');
  let queue = Promise.resolve(), stopped = false, revision = 0;
  const blobs = new Map();
  const save = () => {
    if (stopped) return;
    const current = ++revision;
    const snapshot = sessionSnapshot(store.state);
    status.textContent = '保存中…';
    // Fetch blobs immediately, before another candidate mutation can revoke their URLs.
    const images = Promise.all(snapshot.state.properties.map(async (p) => {
      const url = p.sheet?.image;
      if (!url?.startsWith('blob:')) return;
      if (!blobs.has(url)) blobs.set(url, fetch(url).then((response) => { if (!response.ok) throw new Error('Image unavailable'); return response.blob(); }));
      snapshot.images[p.id] = await blobs.get(url);
      p.sheet.image = null;
    }));
    images.catch(() => {});
    queue = queue.catch(() => {}).then(async () => {
      await images;
      if (stopped) return;
      await transaction('readwrite', (s) => s.put(snapshot, 'current'));
      if (current === revision) status.textContent = 'このブラウザに保存済み';
    }).catch(() => { if (current === revision) status.textContent = '保存できませんでした。このタブを閉じる前にメモをコピーしてください。'; });
  };
  store.on('change', save); store.on('advisor', save);
  status.textContent = initialError ? '保存データを復元できませんでした。次の変更から保存します。' : 'このブラウザに自動保存';
  if (!initialError) save();
  document.querySelector('#clearSession').addEventListener('click', async () => {
    if (!window.confirm('保存した候補・画像・回答・メモを削除して、サンプルからやり直しますか？')) return;
    stopped = true;
    try { await queue; await transaction('readwrite', (s) => s.delete('current')); location.href = location.pathname; }
    catch { stopped = false; status.textContent = '保存データを削除できませんでした。もう一度お試しください。'; }
  });
}
