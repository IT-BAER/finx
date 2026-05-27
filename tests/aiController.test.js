const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

// Stub the aiProxy before requiring the controller.
const proxyMock = mock.fn(async () => ({
  parsed: {
    amount: 5,
    currency: "EUR",
    type: "expense",
    description: "Coffee",
    category: null,
    source: null,
    target: null,
    date: null,
  },
  model: "test-model",
}));

require.cache[require.resolve("../services/aiProxy")] = {
  exports: {
    callAiProxy: proxyMock,
    PURPOSES: { NOTIFICATION_PARSE: {} },
  },
};

const { parseNotification } = require("../controllers/aiController");

const makeApp = () => {
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use((req, _res, next) => {
    req.user = { id: 7 };
    next();
  });
  app.post("/parse", parseNotification);
  return app;
};

test("rejects body without text/title/body", async () => {
  const r = await request(makeApp()).post("/parse").send({});
  assert.equal(r.status, 400);
});

test("rejects oversized text", async () => {
  const r = await request(makeApp())
    .post("/parse")
    .send({ text: "a".repeat(3000) });
  assert.equal(r.status, 400);
});

test("rejects oversized arrays (zod cap)", async () => {
  const r = await request(makeApp())
    .post("/parse")
    .send({
      text: "hi",
      categories: Array.from({ length: 500 }, (_, i) => `c${i}`),
    });
  assert.equal(r.status, 400);
});

test("sanitizes accepted body and calls aiProxy", async () => {
  proxyMock.mock.resetCalls();
  const r = await request(makeApp())
    .post("/parse")
    .send({ text: "Spent 5 EUR", categories: ["food", "x".repeat(100)] });
  assert.equal(r.status, 200);
  assert.equal(proxyMock.mock.calls.length, 1);
  const call = proxyMock.mock.calls[0].arguments[0];
  assert.equal(call.purpose, "NOTIFICATION_PARSE");
  assert.equal(call.userId, 7);
  // long category clipped to 64
  assert.ok(call.vars.categories[1].length <= 64);
});

test("oversized payload returns 413", async () => {
  const app = makeApp();
  const r = await request(app).post("/parse").send({ text: "x".repeat(35000) });
  assert.equal(r.status, 413);
});
