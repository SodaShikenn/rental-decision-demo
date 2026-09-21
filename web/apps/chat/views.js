// Chat DOM: message list, suggested prompts, and the question form.
import { $ } from "../../helper.js";
import { respondToChat } from "./services.js";

/** Append a message. Assistant messages are trusted HTML from services; user text is never parsed as HTML. */
export function addMessage(role, content) {
  const container = $("#messages");
  const item = document.createElement("div");
  item.className = `message ${role}`;
  if (role === "user") item.textContent = content;
  else item.innerHTML = content;
  container.append(item);
  container.scrollTop = container.scrollHeight;
}

export function bindChat(app) {
  const { state } = app.extensions.store;
  const ask = (question) => {
    addMessage("user", question);
    addMessage("assistant", respondToChat(question, state));
  };
  $("#promptSuggestions").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) ask(button.textContent);
  });
  $("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#chatInput");
    const question = input.value.trim();
    if (!question) return;
    ask(question);
    input.value = "";
  });
}
