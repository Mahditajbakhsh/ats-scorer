// Worker route tests with a fake Workers AI binding (no network). Run with: npm test
import test from "node:test";
import assert from "node:assert";
import worker from "../src/worker.js";

const JD = "Laboratory Engineer, Chemistry. Eurofins Ahma Oy is looking for a Laboratory Engineer in Oulu. Tasks include HPLC, GC-MS, ICP-OES, method validation and LIMS reporting. We expect an MSc or BSc in chemistry and two years of laboratory experience. Send your application to jobs@example.com with reference LAB-42.";
const FACTS = [{ id: "F1", label: "name", text: "Mahdi Example" }, { id: "F2", label: "email", text: "mahdi@example.com" }];
const post = (body, token = "t0ken") => new Request("https://x.test/api/email", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify(body) });
const words = (n) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");

function fakeAI(replies) {
  const calls = [];
  return { calls, run: async (model, input) => { calls.push({ model, input }); const r = replies.shift(); if (r instanceof Error) throw r; return { response: r }; } };
}

test("email: password required", async () => {
  const env = { ACCESS_TOKEN: "t0ken", AI: fakeAI([]) };
  const r = await worker.fetch(post({ jd: JD, facts: FACTS }, "wrong"), env);
  assert.strictEqual(r.status, 401);
  assert.strictEqual(env.AI.calls.length, 0, "model not called without password");
});

test("email: works without an Anthropic key and uses JSON mode with Llama", async () => {
  const env = { ACCESS_TOKEN: "t0ken", AI: fakeAI([{ subject: "Laboratory Engineer application", body: "Dear Hiring Manager,\n\nShort body." }]) };
  const r = await worker.fetch(post({ jd: JD, facts: FACTS, title: "Laboratory Engineer" }), env);
  const d = await r.json();
  assert.strictEqual(r.status, 200, JSON.stringify(d));
  assert.strictEqual(d.retried, false);
  const call = env.AI.calls[0];
  assert.match(call.model, /llama-3\.3-70b/);
  assert.strictEqual(call.input.response_format.type, "json_schema");
  assert.ok(call.input.messages[1].content.includes("F1 [name]: Mahdi Example"));
  assert.ok(!call.input.messages[1].content.includes("undefined"));
});

test("email: over 150 words triggers exactly one shorter retry", async () => {
  const env = { ACCESS_TOKEN: "t0ken", AI: fakeAI([{ subject: "s", body: words(180) }, { subject: "s", body: words(100) }]) };
  const d = await (await worker.fetch(post({ jd: JD, facts: FACTS }), env)).json();
  assert.strictEqual(env.AI.calls.length, 2);
  assert.strictEqual(d.retried, true);
  assert.strictEqual(d.words, 100);
});

test("email: string JSON response is parsed, quota error is reported clearly", async () => {
  const env = { ACCESS_TOKEN: "t0ken", AI: fakeAI([JSON.stringify({ subject: "s", body: "b" })]) };
  assert.strictEqual((await worker.fetch(post({ jd: JD, facts: FACTS }), env)).status, 200);
  const env2 = { ACCESS_TOKEN: "t0ken", AI: fakeAI([new Error("4006: you have used up your daily free allocation of 10,000 neurons")]) };
  const r2 = await worker.fetch(post({ jd: JD, facts: FACTS }), env2);
  assert.strictEqual(r2.status, 429);
});

test("email: missing AI binding gives 503, status reports email flag", async () => {
  const r = await worker.fetch(post({ jd: JD, facts: FACTS }), { ACCESS_TOKEN: "t0ken" });
  assert.strictEqual(r.status, 503);
  const st = await (await worker.fetch(new Request("https://x.test/api/status"), { AI: {}, ACCESS_TOKEN: "x" })).json();
  assert.deepStrictEqual(st, { ai: false, email: true, auth: true });
});
