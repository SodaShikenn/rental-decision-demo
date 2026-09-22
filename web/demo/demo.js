const film = document.querySelector("#film");
const list = document.querySelector("#chapters");
const transcript = document.querySelector("#transcript");
const time = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
try {
  const response = await fetch("media/chapters.json");
  if (!response.ok) throw new Error("Chapters unavailable");
  const chapters = await response.json();
  const buttons = chapters.map((chapter, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const timestamp = document.createElement("time");
    timestamp.textContent = time(chapter.start);
    const label = document.createElement("span");
    label.textContent = chapter.label;
    button.append(timestamp, label);
    button.addEventListener("click", () => {
      history.replaceState(null, "", `#chapter=${index}`);
      film.currentTime = chapter.start;
      film.play().catch(() => film.focus());
    });
    li.append(button);
    list.append(li);
    const heading = document.createElement("h3");
    heading.textContent = `${time(chapter.start)} · ${chapter.title}`;
    const english = document.createElement("p");
    english.textContent = chapter.caption;
    const japanese = document.createElement("p");
    japanese.lang = "ja";
    japanese.textContent = chapter.ja;
    transcript.append(heading, english, japanese);
    return button;
  });
  const sync = () => {
    const current = Math.max(
      0,
      chapters.findLastIndex((chapter) => film.currentTime >= chapter.start),
    );
    buttons.forEach((button, index) =>
      button.setAttribute("aria-current", String(index === current)),
    );
  };
  film.addEventListener("timeupdate", sync);
  film.addEventListener("seeked", sync);
  sync();
  const seekFromHash = () => {
    const value = new URLSearchParams(location.hash.slice(1)).get("chapter");
    if (!/^\d+$/.test(value || "")) return;
    const chapter = chapters[Number(value)];
    if (chapter) film.currentTime = chapter.start;
  };
  const ready = () => {
    document.querySelector("#duration").textContent =
      `${time(film.duration)} / ${chapters.length} chapters`;
    seekFromHash();
  };
  if (film.readyState >= 1) ready();
  else film.addEventListener("loadedmetadata", ready, { once: true });
  window.addEventListener("hashchange", seekFromHash);
} catch {
  list.textContent =
    "Chapters could not load. The video controls and downloadable transcript are still available.";
  const link = document.createElement("a");
  link.href = "media/transcript.md";
  link.textContent = "Read the transcript";
  transcript.append(link);
}
