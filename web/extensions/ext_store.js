import { emptyPriorities } from "../apps/priorities/services.js";
// Application state with change events; session.js persists user work in IndexedDB.
//
// Events: "change"        after sheets, a rent entered for a sheet, a chip, or an answer changed (views re-render),
//         "memo"          after the person edited the memo text (only the memo controls re-render),
//         "added"         with the id of a sheet that was just added through the intake dialog,
//         "server-status" with the extraction server's state (see the capabilities app).

export function createStore({ properties, settings }) {
  const listeners = new Map();
  const state = {
    priorities: emptyPriorities(),
    workspace: { dimension: 'cost', pair: [], mobile: false },
    advisor: { history: [], reply: null, fingerprint: "", usesMaps: false },
    // Sheets in the order they were added. Nothing reorders them.
    properties: properties.map((property) => ({ ...property })),
    // { moveIn, brokerageMonths } for the move-in estimate.
    settings: { ...settings },
    // Per sheet id, a rent the person entered for a sheet that prints none (yen).
    rentOverrides: {},
    // Per aspect key, a chip the person pressed (true) or released (false); absent follows the count.
    pickOverrides: {},
    // Per question key, the answer: "yes" | "no" | "later", or an array of checked values.
    answers: {},
    // The memo text as the person edited it, or null while it follows the sheets.
    memoEdit: null,
    // sheetsVersion when the current edit began, so the memo can say the sheets changed since.
    memoEditVersion: null,
    // Bumped whenever a sheet is added, replaced, or removed.
    sheetsVersion: 0,
  };
  const emit = (event, payload) => (listeners.get(event) ?? []).forEach((listener) => listener(payload));
  const revoke = (image) => {
    if (typeof image === "string" && image.startsWith("blob:")) URL.revokeObjectURL(image);
  };

  return {
    state,
    emit,
    setWorkspace(patch) {
      state.workspace = { ...state.workspace, ...patch };
      emit('workspace');
    },
    setAdvisor(advisor) {
      state.advisor = advisor;
      emit("advisor");
    },
    setPriorities(priorities) {
      state.priorities = priorities;
      emit("change");
    },
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    /** Add a sheet at the end, or replace the one with the same id where it stands. */
    upsertProperty(property) {
      const index = state.properties.findIndex((existing) => existing.id === property.id);
      if (index >= 0) {
        const replaced = state.properties[index].sheet?.image;
        if (replaced !== property.sheet?.image) revoke(replaced);
        state.properties.splice(index, 1, property);
      } else {
        state.properties.push(property);
      }
      state.sheetsVersion += 1;
      emit("change");
    },
    /** Take a sheet out of the comparison, releasing its uploaded image and any rent entered for it. */
    removeProperty(id) {
      const property = state.properties.find((existing) => existing.id === id);
      if (!property) return;
      revoke(property.sheet?.image);
      state.properties = state.properties.filter((existing) => existing.id !== id);
      delete state.rentOverrides[id];
      state.sheetsVersion += 1;
      emit("change");
    },
    /** A rent the person asked the agent about, for a sheet that prints none (null clears it). */
    setRentOverride(id, yen) {
      if (yen == null) delete state.rentOverrides[id];
      else state.rentOverrides[id] = yen;
      emit("change");
    },
    /** Press or release a chip; null returns it to what the counts say. */
    setPick(key, pressed) {
      if (pressed == null) delete state.pickOverrides[key];
      else state.pickOverrides[key] = pressed;
      emit("change");
    },
    answer(questionKey, value) {
      state.answers[questionKey] = value;
      emit("change");
    },
    /** The person's own memo text, or null to follow the sheets again. */
    setMemoEdit(text) {
      if (text == null) state.memoEditVersion = null;
      else if (state.memoEdit == null) state.memoEditVersion = state.sheetsVersion;
      state.memoEdit = text;
      emit("memo");
    },
  };
}

export function initApp(app, seed) {
  app.extensions.store = createStore(seed);
}
