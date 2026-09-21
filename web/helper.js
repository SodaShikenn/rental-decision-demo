// Shared helpers used across apps (≈ helper.py). Keep them free of app state.

/** Yen the way listings print it: 5000 → "5,000円". */
export const yen = (value) => `${Math.round(value).toLocaleString("ja-JP")}円`;

/** Rent the way listings print it: 129000 → "12.9万円". */
export const man = (value) => `${(value / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}万円`;

/** Floor area in tsubo, as printed next to ㎡ on listing sheets (1坪 = 3.30579㎡). */
export const tsubo = (sqm) => (sqm / 3.30579).toFixed(2);

export const escapeHTML = (value) =>
  String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

export const formatTime = (iso) =>
  new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Draw one evidence region of a sheet image (box = [x, y, width, height], 0–1 of the image) into a
 * canvas, with a little surrounding context. The image must be loaded.
 */
export function drawEvidenceCrop(canvas, image, [x, y, w, h], maxWidth = 640) {
  const padX = 0.006;
  const padY = 0.004;
  const sx = Math.max(0, (x - padX) * image.naturalWidth);
  const sy = Math.max(0, (y - padY) * image.naturalHeight);
  const sw = Math.min(image.naturalWidth - sx, (w + padX * 2) * image.naturalWidth);
  const sh = Math.min(image.naturalHeight - sy, (h + padY * 2) * image.naturalHeight);
  const scale = Math.min(1, maxWidth / sw);
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

/** A small "?" button that opens the glossary on `term` (handled by the glossary app). */
export const termButton = (term, label = term) =>
  `<button class="term-help" type="button" data-term="${escapeHTML(term)}" aria-label="「${escapeHTML(label)}」の意味" title="「${escapeHTML(label)}」の意味">?</button>`;
