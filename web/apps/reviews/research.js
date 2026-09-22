/** Session-only cache: no third-party review text enters local storage or shared briefs. */
export function reviewInput(candidate) {
  return candidate
    ? {
        name: candidate.name,
        address: candidate.address || "",
        room: candidate.room || "",
        sourceUrl: candidate.sourceUrl || null,
      }
    : null;
}
export function createReviewResearch({
  request,
  onChange,
  now = Date.now,
  ttl = 30 * 60_000,
}) {
  const cache = new Map();
  let current = "",
    generation = 0,
    controller;
  function select(candidate, { force = false } = {}) {
    const input = reviewInput(candidate);
    const key = candidate ? JSON.stringify([candidate.id, input]) : "";
    if (key !== current || force) {
      ++generation;
      controller?.abort();
      if (cache.get(current)?.status === "loading") cache.delete(current);
      current = key;
    }
    if (!candidate) {
      onChange({ status: "empty" });
      return Promise.resolve();
    }
    const cached = cache.get(key);
    if (!force && cached && now() - cached.at < ttl) {
      onChange(cached);
      return Promise.resolve();
    }
    const id = ++generation;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const controllerForRequest = controller;
    const timer = setTimeout(() => controllerForRequest.abort(), 120_000);
    const update = (entry) => {
      if (id !== generation) return;
      cache.set(key, { ...entry, at: now() });
      // Bound memory even if a candidate is edited repeatedly.
      while (cache.size > 12) cache.delete(cache.keys().next().value);
      onChange(cache.get(key));
    };
    update({ status: "loading" });
    return Promise.resolve()
      .then(() => request(input, { signal }))
      .then(
        (data) => update({ status: "ready", data }),
        (error) =>
          update({
            status: "error",
            message:
              error.name === "AbortError"
                ? "検索がタイムアウトしました。再検索してください。"
                : error.message,
          }),
      )
      .finally(() => clearTimeout(timer));
  }
  return { select };
}
