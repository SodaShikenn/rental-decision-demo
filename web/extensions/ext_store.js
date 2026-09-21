// In-memory application state with change events (≈ ext_database). Nothing is persisted:
// a reload restores the demo data.
//
// Events: "change" after the candidate list or selection changes (views re-render),
//         "recalculated" with the best candidate after the user re-runs the comparison.

export function createStore({ properties, preferences, selectedId }) {
  const listeners = new Map();
  const state = {
    properties: properties.map((property) => ({ ...property })),
    // Preferences are edited in place by the controls and only take effect on "この暮らしで再比較".
    preferences: { budget: preferences.budget, priorities: new Set(preferences.priorities), weekend: preferences.weekend },
    selectedId,
  };
  const emit = (event, payload) => (listeners.get(event) ?? []).forEach((listener) => listener(payload));

  return {
    state,
    emit,
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    selected: () => state.properties.find((property) => property.id === state.selectedId),
    select(id) {
      state.selectedId = id;
      emit("change");
    },
    upsertProperty(property, { select = false } = {}) {
      const index = state.properties.findIndex((existing) => existing.id === property.id);
      if (index >= 0) state.properties.splice(index, 1, property);
      else state.properties.push(property);
      if (select) state.selectedId = property.id;
      emit("change");
    },
  };
}

export function initApp(app, seed) {
  app.extensions.store = createStore(seed);
}
