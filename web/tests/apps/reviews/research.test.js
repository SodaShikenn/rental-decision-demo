import test from "node:test";
import assert from "node:assert/strict";
import {
  createReviewResearch,
  reviewInput,
} from "../../../apps/reviews/research.js";
const candidate = {
  id: "a",
  name: "建物 A",
  address: "東京1-2-3",
  room: "101",
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
test("review requests contain identity only, never image or personal notes", () => {
  assert.deepEqual(
    reviewInput({ ...candidate, sheet: { image: "private" }, memo: "private" }),
    {
      name: "建物 A",
      address: "東京1-2-3",
      room: "101",
      sourceUrl: null,
    },
  );
});
test("navigation reuses results; refresh, edited identity and TTL trigger research", async () => {
  let calls = 0,
    time = 0,
    state;
  const research = createReviewResearch({
    request: async () => ({ count: ++calls }),
    onChange: (s) => {
      state = s;
    },
    now: () => time,
    ttl: 100,
  });
  await research.select(candidate);
  await research.select(candidate);
  assert.equal(calls, 1);
  await research.select(candidate, { force: true });
  assert.equal(calls, 2);
  await research.select({ ...candidate, address: "東京1-2-4" });
  assert.equal(calls, 3);
  await research.select(candidate);
  assert.equal(calls, 3);
  time = 101;
  await research.select(candidate);
  assert.equal(calls, 4);
  assert.equal(state.status, "ready");
});
test("a late response cannot replace another candidate, including empty selection", async () => {
  const a = deferred(),
    b = deferred();
  let state, firstSignal;
  const research = createReviewResearch({
    request: (input, { signal }) => {
      if (input.name === candidate.name) {
        firstSignal = signal;
        return a.promise;
      }
      return b.promise;
    },
    onChange: (s) => {
      state = s;
    },
  });
  const pendingA = research.select(candidate);
  await Promise.resolve();
  const pendingB = research.select({ ...candidate, id: "b", name: "建物 B" });
  assert.equal(firstSignal.aborted, true);
  b.resolve({ building: "B" });
  await pendingB;
  a.resolve({ building: "A" });
  await pendingA;
  assert.equal(state.data.building, "B");
  await research.select(null);
  assert.equal(state.status, "empty");
});
test("pending calls and failures do not automatically retry on unrelated state changes", async () => {
  const wait = deferred();
  let calls = 0,
    state;
  const research = createReviewResearch({
    request: async () => {
      calls++;
      await wait.promise;
      throw new Error("provider unavailable");
    },
    onChange: (s) => {
      state = s;
    },
  });
  const first = research.select(candidate);
  await research.select(candidate);
  assert.equal(calls, 1);
  wait.resolve();
  await first;
  await research.select(candidate);
  assert.equal(calls, 1);
  assert.equal(state.message, "provider unavailable");
  await research.select(candidate, { force: true });
  assert.equal(calls, 2);
});
