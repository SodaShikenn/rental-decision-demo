/** Presentation only: keyboard actions stay instant; native controls own focus and state. */
export function initInteractions() {
  const root = document.documentElement;
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      root.dataset.input = "keyboard";
    },
    { capture: true },
  );
  document.addEventListener(
    "pointerdown",
    () => {
      root.dataset.input = "pointer";
    },
    { capture: true, passive: true },
  );

  // This is a disclosure, not an ARIA menu: native Tab/Enter remain available.
  const more = document.querySelector(".more-inputs");
  if (!more) return;
  document.addEventListener("click", (event) => {
    if (!more.open) return;
    if (!more.contains(event.target) || event.target.closest("button"))
      more.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !more.open) return;
    event.preventDefault();
    more.open = false;
    more.querySelector("summary").focus();
  });
}
