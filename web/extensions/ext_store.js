// In-memory application state with change events (≈ ext_database). Nothing is persisted:
// a reload restores the recorded candidates.
//
// Events: "change" after candidates, selection, preferences, or cost adjustments change (views re-render),
//         "added" with the id of a candidate that was just added from a listing sheet.

export function createStore({ properties, preferences, selectedId }) {
  const listeners = new Map();
  const state = {
    properties: properties.map((property) => ({ ...property })),
    preferences: { ...preferences, priorities: new Set(preferences.priorities), situations: new Set(preferences.situations ?? []) },
    // Per candidate, what the person changed in the move-in estimate: { rentOverride, toggled }.
    costAdjustments: {},
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
    /** Apply an edit to the preferences and re-rank immediately. */
    updatePreferences(edit) {
      edit(state.preferences);
      emit("change");
    },
    select(id) {
      state.selectedId = id;
      emit("change");
    },
    /** Edit one candidate's estimate adjustments and re-render. */
    adjustCosts(id, edit) {
      const current = state.costAdjustments[id] ?? { rentOverride: null, toggled: [] };
      edit(current);
      state.costAdjustments[id] = current;
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
